using System.Collections.Concurrent;
using CatanServer.Contracts;
using CatanServer.Domain;
using CatanServer.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace CatanServer.Services;

/// <summary>
/// Withdraws a player-to-player offer that nobody closed in time.
///
/// The expiry has to be the server's call, not each client's: the countdown bar every player
/// watches is drawn from the offer's own <c>ExpiresAt</c>, so one authoritative clock keeps
/// every screen - and the game - in agreement. Modelled on <see cref="TurnTimerService"/>:
/// one timer per room, registered as a singleton so it outlives the transient hubs that arm it.
/// </summary>
public sealed class TradeTimerService : IDisposable
{
    /// <summary>Slack past the deadline, so a confirmation already in flight still lands.</summary>
    private static readonly TimeSpan Grace = TimeSpan.FromMilliseconds(400);

    private sealed class Entry : IDisposable
    {
        public required Timer Timer { get; init; }
        public Guid OfferId { get; set; }
        public void Dispose() => Timer.Dispose();
    }

    private readonly ConcurrentDictionary<string, Entry> _timers = new(StringComparer.OrdinalIgnoreCase);
    private readonly RoomManager _rooms;
    private readonly IHubContext<GameHub, IGameClient> _hub;
    private readonly ILogger<TradeTimerService> _logger;

    /// <summary>Raised after an offer has expired and the new state has gone out.</summary>
    public event Action<Room>? Expired;

    public TradeTimerService(RoomManager rooms, IHubContext<GameHub, IGameClient> hub, ILogger<TradeTimerService> logger)
    {
        _rooms = rooms;
        _hub = hub;
        _logger = logger;
    }

    /// <summary>
    /// Called after every move. Starts a clock for a newly posted offer, and stops the clock
    /// once the offer is gone. An offer already being timed is left alone, so unrelated moves
    /// do not keep extending its life.
    /// </summary>
    public void Sync(Room room)
    {
        if (room.Status != RoomStatus.InGame)
        {
            Stop(room.Id);
            return;
        }

        var offer = room.Game.GetGameState().ActiveTradeOffer;
        if (offer?.ExpiresAt is not { } deadline)
        {
            Stop(room.Id);
            return;
        }

        var entry = _timers.GetOrAdd(room.Id, id => new Entry
        {
            Timer = new Timer(_ => _ = FireAsync(id), null, Timeout.InfiniteTimeSpan, Timeout.InfiniteTimeSpan),
        });

        if (entry.OfferId == offer.OfferId)
        {
            return;
        }

        entry.OfferId = offer.OfferId;
        var remaining = deadline - DateTimeOffset.UtcNow + Grace;
        entry.Timer.Change(remaining > TimeSpan.Zero ? remaining : TimeSpan.Zero, Timeout.InfiniteTimeSpan);
    }

    public void Stop(string roomId)
    {
        if (_timers.TryRemove(roomId, out var entry))
        {
            entry.Dispose();
        }
    }

    private async Task FireAsync(string roomId)
    {
        if (!_timers.TryGetValue(roomId, out var entry) || !_rooms.TryGet(roomId, out var room))
        {
            return;
        }

        var offerId = entry.OfferId;

        try
        {
            // Nothing to do if the offer was closed, declined or replaced while we waited:
            // ExpireTrade only bites when this exact offer is still the live one.
            var state = room.Game.ExpireTrade(offerId);
            if (state is null)
            {
                return;
            }

            _logger.LogInformation("[{RoomId}] Trade offer {OfferId} expired", roomId, offerId);

            await _hub.Clients.Group(roomId).TradeResolved(new TradeResolvedDto(offerId, null, "Expired"));
            await _hub.Clients.Group(roomId).SystemMessage(new SystemMessageDto(
                "The trade offer expired.", "info", DateTimeOffset.UtcNow));

            var sends = room.Members
                .Where(m => m.ConnectionId is not null)
                .Select(m => _hub.Clients.Client(m.ConnectionId!).GameState(new ClientGameStateDto(state, m.Id)));
            await Task.WhenAll(sends);

            Expired?.Invoke(room);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{RoomId}] Trade expiry failed", roomId);
        }
        finally
        {
            Stop(roomId);
        }
    }

    public void Dispose()
    {
        foreach (var entry in _timers.Values)
        {
            entry.Dispose();
        }

        _timers.Clear();
    }
}
