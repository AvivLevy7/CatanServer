using System.Collections.Concurrent;
using CatanServer.Contracts;
using CatanServer.Domain;
using CatanServer.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace CatanServer.Services;

/// <summary>
/// AFK protection. One <see cref="Timer"/> per room; when it fires the game takes the
/// minimum legal action for the stalled player (auto-roll, auto-end-turn, random robber
/// move, forced discards) and broadcasts the result. Registered as a singleton so timers
/// outlive the transient hub instances that arm them.
/// </summary>
public sealed class TurnTimerService : IDisposable
{
    public static readonly TimeSpan TurnLength = TimeSpan.FromSeconds(60);

    /// <summary>Grace left to a player who disconnects mid-turn.</summary>
    public static readonly TimeSpan DisconnectGrace = TimeSpan.FromSeconds(15);

    private sealed class Entry : IDisposable
    {
        public required Timer Timer { get; init; }
        public (GamePhase Phase, Guid Actor, bool Rolled, int Turn) Key { get; set; }
        public DateTimeOffset Deadline { get; set; }
        public int Firing;
        public void Dispose() => Timer.Dispose();
    }

    private readonly ConcurrentDictionary<string, Entry> _timers = new(StringComparer.OrdinalIgnoreCase);
    private readonly RoomManager _rooms;
    private readonly IHubContext<GameHub, IGameClient> _hub;
    private readonly ILogger<TurnTimerService> _logger;

    /// <summary>Raised after a timeout has been resolved and broadcast (the turn may now belong to a bot).</summary>
    public event Action<Room>? Resolved;

    public TurnTimerService(RoomManager rooms, IHubContext<GameHub, IGameClient> hub, ILogger<TurnTimerService> logger)
    {
        _rooms = rooms;
        _hub = hub;
        _logger = logger;
    }

    /// <summary>
    /// Called after every successful move. Restarts the clock only when the actor-to-wait-for
    /// changed (new turn, robber phase, roll), so building several things in a row does not
    /// keep extending the turn.
    /// </summary>
    public void Sync(Room room)
    {
        if (room.Status != RoomStatus.InGame)
        {
            Stop(room.Id);
            return;
        }

        var key = room.Game.TurnKey;
        if (key.Phase == GamePhase.GameOver)
        {
            Stop(room.Id);
            return;
        }

        var entry = _timers.GetOrAdd(room.Id, id => new Entry
        {
            Timer = new Timer(_ => _ = FireAsync(id), null, Timeout.InfiniteTimeSpan, Timeout.InfiniteTimeSpan),
        });

        if (entry.Key == key && entry.Deadline > DateTimeOffset.UtcNow)
        {
            return;
        }

        var length = IsActorConnected(room, key.Actor) ? TurnLength : DisconnectGrace;
        Arm(room, entry, key, length);
    }

    /// <summary>Hard reset to a full turn (e.g. after a restart).</summary>
    public void Reset(Room room)
    {
        Stop(room.Id);
        Sync(room);
    }

    /// <summary>A player dropped: if it is their clock, cut it down to the grace period.</summary>
    public void OnPlayerDisconnected(Room room, Guid playerId)
    {
        if (!_timers.TryGetValue(room.Id, out var entry) || entry.Key.Actor != playerId)
        {
            return;
        }

        var remaining = entry.Deadline - DateTimeOffset.UtcNow;
        if (remaining <= DisconnectGrace)
        {
            return;
        }

        Arm(room, entry, entry.Key, DisconnectGrace);
        _ = _hub.Clients.Group(room.Id).SystemMessage(new SystemMessageDto(
            $"{NameOf(room, playerId)} disconnected. Their turn ends in {DisconnectGrace.TotalSeconds:0} seconds unless they return.",
            "bad",
            DateTimeOffset.UtcNow));
    }

    /// <summary>The actor came back: give them a full turn again if they were on the short clock.</summary>
    public void OnPlayerReconnected(Room room, Guid playerId)
    {
        if (!_timers.TryGetValue(room.Id, out var entry) || entry.Key.Actor != playerId)
        {
            return;
        }

        if (entry.Deadline - DateTimeOffset.UtcNow <= DisconnectGrace)
        {
            Arm(room, entry, entry.Key, TurnLength);
        }
    }

    public void Stop(string roomId)
    {
        if (_timers.TryRemove(roomId, out var entry))
        {
            entry.Dispose();
        }

        if (_rooms.TryGet(roomId, out var room))
        {
            room.Game.SetTurnDeadline(null);
        }
    }

    private void Arm(Room room, Entry entry, (GamePhase, Guid, bool, int) key, TimeSpan length)
    {
        entry.Key = key;
        entry.Deadline = DateTimeOffset.UtcNow + length;
        room.Game.SetTurnDeadline(entry.Deadline);
        entry.Timer.Change(length, Timeout.InfiniteTimeSpan);

        // Push the new deadline so every client's countdown lines up with the server.
        _ = BroadcastState(room, room.Game.GetGameState());
    }

    private async Task FireAsync(string roomId)
    {
        if (!_timers.TryGetValue(roomId, out var entry) || !_rooms.TryGet(roomId, out var room))
        {
            return;
        }

        // Timer callbacks can overlap with Sync; make sure only one resolution runs.
        if (Interlocked.Exchange(ref entry.Firing, 1) == 1)
        {
            return;
        }

        try
        {
            // Stale fire: the player acted in the meantime and the clock was rearmed.
            if (entry.Deadline > DateTimeOffset.UtcNow.AddMilliseconds(250))
            {
                return;
            }

            var result = room.Game.ResolveTimeout();
            if (result is null)
            {
                Stop(roomId);
                return;
            }

            var (resolution, roll, state) = result.Value;
            var name = NameOf(room, resolution.TimedOutPlayerId);
            var text = $"{name} ran out of time! {Capitalise(string.Join(", ", resolution.Actions))}.";
            _logger.LogInformation("[{RoomId}] Timeout: {Text}", roomId, text);

            await _hub.Clients.Group(roomId).SystemMessage(new SystemMessageDto(text, "bad", DateTimeOffset.UtcNow));
            if (roll is not null)
            {
                await _hub.Clients.Group(roomId).DiceRolled(roll);
            }

            await BroadcastState(room, state);

            if (state.Phase == nameof(GamePhase.GameOver) && state.WinnerId is { } winnerId)
            {
                await _hub.Clients.Group(roomId).GameOver(state.Players.First(p => p.Id == winnerId).Redacted());
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{RoomId}] Timeout resolution failed", roomId);
        }
        finally
        {
            Volatile.Write(ref entry.Firing, 0);
            // Arm the clock for whoever is up next.
            Sync(room);
            Resolved?.Invoke(room);
        }
    }

    private Task BroadcastState(Room room, GameStateDto state)
    {
        var sends = room.Members
            .Where(m => m.ConnectionId is not null)
            .Select(m => _hub.Clients.Client(m.ConnectionId!).GameState(new ClientGameStateDto(state, m.Id)));
        return Task.WhenAll(sends);
    }

    private static bool IsActorConnected(Room room, Guid actor) =>
        room.FindById(actor) is { } m && (m.IsBot || m.ConnectionId is not null);

    private static string NameOf(Room room, Guid playerId) =>
        room.FindById(playerId)?.Name ?? "A player";

    private static string Capitalise(string s) =>
        string.IsNullOrEmpty(s) ? s : char.ToUpperInvariant(s[0]) + s[1..];

    public void Dispose()
    {
        foreach (var entry in _timers.Values)
        {
            entry.Dispose();
        }

        _timers.Clear();
    }
}
