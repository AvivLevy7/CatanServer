using System.Collections.Concurrent;
using CatanServer.Contracts;
using CatanServer.Domain;

namespace CatanServer.Services;

public enum RoomStatus
{
    Lobby,
    InGame
}

/// <summary>A seat in a room: a human identity that maps onto a <see cref="Player"/> once the game starts.</summary>
public sealed class RoomMember
{
    public RoomMember(Guid id, string name, PlayerColor color, string connectionId)
    {
        Id = id;
        Name = name;
        Color = color;
        ConnectionId = connectionId;
    }

    public Guid Id { get; }

    public string Name { get; }

    public PlayerColor Color { get; }

    /// <summary>Null while the player is disconnected (they may rejoin with the same id).</summary>
    public string? ConnectionId { get; internal set; }
}

/// <summary>One lobby/game. Owns its own <see cref="GameStateService"/> so rooms never share state.</summary>
public sealed class Room
{
    private readonly List<RoomMember> _members = [];
    private readonly Lock _gate = new();

    public Room(string id)
    {
        Id = id;
        Game = new GameStateService();
    }

    public string Id { get; }

    public RoomStatus Status { get; private set; } = RoomStatus.Lobby;

    public IGameStateService Game { get; }

    public Guid HostPlayerId => _members.Count > 0 ? _members[0].Id : Guid.Empty;

    public IReadOnlyList<RoomMember> Members
    {
        get
        {
            lock (_gate)
            {
                return _members.ToArray();
            }
        }
    }

    public RoomMember AddMember(string name, string connectionId)
    {
        lock (_gate)
        {
            if (Status != RoomStatus.Lobby)
            {
                throw new GameRuleException("That game has already started.");
            }

            if (_members.Count >= GameStateService.MaxPlayers)
            {
                throw new GameRuleException("That room is full.");
            }

            var color = RoomManager.SeatColors.First(c => _members.All(m => m.Color != c));
            var member = new RoomMember(Guid.NewGuid(), name, color, connectionId);
            _members.Add(member);
            return member;
        }
    }

    public RoomMember? FindByConnection(string connectionId)
    {
        lock (_gate)
        {
            return _members.FirstOrDefault(m => m.ConnectionId == connectionId);
        }
    }

    public RoomMember? FindById(Guid playerId)
    {
        lock (_gate)
        {
            return _members.FirstOrDefault(m => m.Id == playerId);
        }
    }

    /// <summary>Reattaches a disconnected member to a new connection.</summary>
    public RoomMember Rejoin(Guid playerId, string connectionId)
    {
        lock (_gate)
        {
            var member = _members.FirstOrDefault(m => m.Id == playerId)
                ?? throw new GameRuleException("You are not a member of that room.");
            member.ConnectionId = connectionId;
            return member;
        }
    }

    /// <summary>Marks the member disconnected. In the lobby they are removed outright. Returns true if the room is now empty.</summary>
    public bool HandleDisconnect(string connectionId)
    {
        lock (_gate)
        {
            var member = _members.FirstOrDefault(m => m.ConnectionId == connectionId);
            if (member is null)
            {
                return _members.Count == 0;
            }

            if (Status == RoomStatus.Lobby)
            {
                _members.Remove(member);
            }
            else
            {
                member.ConnectionId = null;
            }

            return _members.Count == 0 || _members.All(m => m.ConnectionId is null);
        }
    }

    public GameStateDto Start(Guid requesterId, bool allowSevens)
    {
        lock (_gate)
        {
            if (Status != RoomStatus.Lobby)
            {
                throw new GameRuleException("The game has already started.");
            }

            if (requesterId != HostPlayerId)
            {
                throw new GameRuleException("Only the host can start the game.");
            }

            var seats = _members.Select(m => (m.Id, m.Name, m.Color)).ToList();
            var state = Game.StartGame(seats, allowSevens);
            Status = RoomStatus.InGame;
            return state;
        }
    }

    public RoomStateDto ToDto()
    {
        lock (_gate)
        {
            return new RoomStateDto(
                Id,
                Status.ToString(),
                HostPlayerId,
                _members.Select(m => new LobbyPlayerDto(m.Id, m.Name, m.Color.ToString(), m.Id == HostPlayerId, m.ConnectionId is not null)).ToList(),
                GameStateService.MaxPlayers,
                GameStateService.MinPlayers);
        }
    }
}

/// <summary>Registry of all live rooms, keyed by short join code.</summary>
public sealed class RoomManager
{
    internal static readonly PlayerColor[] SeatColors =
    [
        PlayerColor.Red, PlayerColor.Blue, PlayerColor.Orange, PlayerColor.White
    ];

    // Unambiguous alphabet: no 0/O or 1/I.
    private const string CodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private const int CodeLength = 4;

    private readonly ConcurrentDictionary<string, Room> _rooms = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, string> _roomByConnection = new();
    // Authoritative identity: which seat a socket is allowed to act as.
    private readonly ConcurrentDictionary<string, Guid> _playerByConnection = new();

    public Room Create()
    {
        while (true)
        {
            var code = NewCode();
            var room = new Room(code);
            if (_rooms.TryAdd(code, room))
            {
                return room;
            }
        }
    }

    public Room Get(string roomId) =>
        _rooms.TryGetValue(Normalise(roomId), out var room)
            ? room
            : throw new GameRuleException($"Room {Normalise(roomId)} does not exist.");

    public bool TryGet(string roomId, out Room room) => _rooms.TryGetValue(Normalise(roomId), out room!);

    public void Track(string connectionId, string roomId, Guid playerId)
    {
        _roomByConnection[connectionId] = Normalise(roomId);
        _playerByConnection[connectionId] = playerId;
    }

    /// <summary>The player this connection authenticated as, or null if it has not joined a room.</summary>
    public Guid? PlayerFor(string connectionId) =>
        _playerByConnection.TryGetValue(connectionId, out var id) ? id : null;

    public Room? RoomFor(string connectionId) =>
        _roomByConnection.TryGetValue(connectionId, out var id) && _rooms.TryGetValue(id, out var room) ? room : null;

    /// <summary>Detaches the connection; drops the room when nobody is left.</summary>
    public Room? Disconnect(string connectionId)
    {
        _playerByConnection.TryRemove(connectionId, out _);
        if (!_roomByConnection.TryRemove(connectionId, out var id) || !_rooms.TryGetValue(id, out var room))
        {
            return null;
        }

        if (room.HandleDisconnect(connectionId))
        {
            _rooms.TryRemove(id, out _);
        }

        return room;
    }

    public static string Normalise(string roomId) => roomId.Trim().ToUpperInvariant();

    private static string NewCode() =>
        string.Create(CodeLength, Random.Shared, static (span, random) =>
        {
            for (var i = 0; i < span.Length; i++)
            {
                span[i] = CodeAlphabet[random.Next(CodeAlphabet.Length)];
            }
        });
}
