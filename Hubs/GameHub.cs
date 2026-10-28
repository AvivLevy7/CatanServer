using CatanServer.Contracts;
using CatanServer.Domain;
using CatanServer.Services;
using Microsoft.AspNetCore.SignalR;

namespace CatanServer.Hubs;

/// <summary>
/// Real-time entry point. Each connection belongs to at most one room; the room id is a
/// SignalR group so broadcasts only reach that table. Server-authoritative: clients
/// request moves and the hub broadcasts the resulting state.
/// </summary>
public sealed class GameHub : Hub<IGameClient>
{
    public const string Route = "/hubs/game";

    private readonly RoomManager _rooms;
    private readonly ILogger<GameHub> _logger;

    public GameHub(RoomManager rooms, ILogger<GameHub> logger)
    {
        _rooms = rooms;
        _logger = logger;
    }

    public override Task OnConnectedAsync()
    {
        _logger.LogInformation("Client {ConnectionId} connected", Context.ConnectionId);
        return base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Client {ConnectionId} disconnected", Context.ConnectionId);

        var room = _rooms.Disconnect(Context.ConnectionId);
        if (room is not null)
        {
            await Clients.Group(room.Id).RoomState(room.ToDto());
        }

        await base.OnDisconnectedAsync(exception);
    }

    // ---------------------------------------------------------------- Lobby

    /// <summary>Creates a room, seats the caller as host and returns the join code.</summary>
    public async Task<JoinedRoomDto> CreateRoom(string playerName)
    {
        var name = RequireName(playerName);
        var room = _rooms.Create();
        var member = room.AddMember(name, Context.ConnectionId);
        await Enter(room, member.Id);

        _logger.LogInformation("Room {RoomId} created by {Name}", room.Id, name);
        return new JoinedRoomDto(room.Id, member.Id, room.ToDto());
    }

    /// <summary>Joins an existing lobby if it has a free seat.</summary>
    public async Task<JoinedRoomDto> JoinRoom(string roomId, string playerName)
    {
        var name = RequireName(playerName);
        Room room;
        RoomMember member;
        try
        {
            room = _rooms.Get(roomId);
            member = room.AddMember(name, Context.ConnectionId);
        }
        catch (GameRuleException ex)
        {
            throw new HubException(ex.Message);
        }

        await Enter(room, member.Id);
        _logger.LogInformation("{Name} joined room {RoomId}", name, room.Id);
        return new JoinedRoomDto(room.Id, member.Id, room.ToDto());
    }

    /// <summary>Reattaches a previous player id (e.g. after a page refresh) to this connection.</summary>
    public async Task<JoinedRoomDto> RejoinRoom(string roomId, Guid playerId)
    {
        Room room;
        try
        {
            room = _rooms.Get(roomId);
            room.Rejoin(playerId, Context.ConnectionId);
        }
        catch (GameRuleException ex)
        {
            throw new HubException(ex.Message);
        }

        await Enter(room, playerId);
        return new JoinedRoomDto(room.Id, playerId, room.ToDto());
    }

    /// <summary>Host starts the game: room moves from Lobby to SetupRound1.</summary>
    public async Task StartGame(string roomId, bool allowSevens = true)
    {
        var room = RequireRoom(roomId);
        var me = CurrentPlayerId();

        GameStateDto state;
        try
        {
            state = room.Start(me, allowSevens);
        }
        catch (GameRuleException ex)
        {
            throw new HubException(ex.Message);
        }

        _logger.LogInformation("Room {RoomId} started with {Count} players", room.Id, state.Players.Count);
        await Clients.Group(room.Id).RoomState(room.ToDto());
        await Clients.Group(room.Id).BoardState(state.Board);
        await Clients.Group(room.Id).GameState(state);
    }

    private async Task Enter(Room room, Guid playerId)
    {
        _rooms.Track(Context.ConnectionId, room.Id, playerId);
        await Groups.AddToGroupAsync(Context.ConnectionId, room.Id);
        await Clients.Group(room.Id).RoomState(room.ToDto());

        if (room.Status == RoomStatus.InGame)
        {
            await Clients.Caller.BoardState(room.Game.GetBoardState());
            await Clients.Caller.GameState(room.Game.GetGameState());
        }
    }

    // ---------------------------------------------------------------- Queries

    public BoardStateDto GetBoardState() => CurrentGame().GetBoardState();

    public GameStateDto GetGameState() => CurrentGame().GetGameState();

    public IReadOnlyList<Guid> GetStealCandidates(string hexId)
    {
        try
        {
            return CurrentGame().GetStealCandidates(hexId);
        }
        catch (GameRuleException ex)
        {
            throw new HubException(ex.Message);
        }
    }

    // ---------------------------------------------------------------- Moves

    public async Task ClientRollDice()
    {
        var (room, me) = CurrentActor();

        (DiceRolledDto Roll, GameStateDto State) result;
        try
        {
            result = room.Game.RollDice(me);
        }
        catch (GameRuleException ex)
        {
            throw new HubException(ex.Message);
        }

        await Clients.Group(room.Id).DiceRolled(result.Roll);
        await Clients.Group(room.Id).GameState(result.State);
    }

    public Task EndTurn() => ApplyMove("EndTurn", "-", (g, me) => g.EndTurn(me));

    public Task BuildSettlement(string nodeId) =>
        ApplyMove("BuildSettlement", nodeId, (g, me) => g.BuildSettlement(me, nodeId));

    public Task BuildRoad(string edgeId) =>
        ApplyMove("BuildRoad", edgeId, (g, me) => g.BuildRoad(me, edgeId));

    public Task BuildCity(string nodeId) =>
        ApplyMove("BuildCity", nodeId, (g, me) => g.BuildCity(me, nodeId));

    public Task TradeWithBank(string resourceToGive, string resourceToReceive) =>
        ApplyMove("TradeWithBank", $"{resourceToGive}->{resourceToReceive}",
            (g, me) => g.TradeWithBank(me, resourceToGive, resourceToReceive));

    public async Task ProposeTrade(string? targetPlayerId, Dictionary<string, int> offered, Dictionary<string, int> requested)
    {
        var (room, me) = CurrentActor();
        Guid? target = Guid.TryParse(targetPlayerId, out var parsed) ? parsed : null;

        (TradeOfferDto Offer, GameStateDto State) result;
        try
        {
            result = room.Game.ProposeTrade(me, target, offered, requested);
        }
        catch (GameRuleException ex)
        {
            throw new HubException(ex.Message);
        }

        await Clients.Group(room.Id).TradeOffered(result.Offer);
        await Clients.Group(room.Id).GameState(result.State);
    }

    /// <summary>The caller accepts the offer. Identity comes from the connection, never the client.</summary>
    public async Task AcceptTrade(string offerId)
    {
        var (room, me) = CurrentActor();
        var id = ParseOfferId(offerId);

        GameStateDto state;
        try
        {
            state = room.Game.AcceptTrade(me, id).State;
        }
        catch (GameRuleException ex)
        {
            throw new HubException(ex.Message);
        }

        await Clients.Group(room.Id).TradeResolved(new TradeResolvedDto(id, me, "Accepted"));
        await Clients.Group(room.Id).GameState(state);
    }

    public async Task RejectTrade(string offerId)
    {
        var (room, me) = CurrentActor();
        var id = ParseOfferId(offerId);

        (TradeOfferDto Offer, bool Removed, GameStateDto State) result;
        try
        {
            result = room.Game.RejectTrade(me, id);
        }
        catch (GameRuleException ex)
        {
            throw new HubException(ex.Message);
        }

        await Clients.Group(room.Id).TradeResolved(new TradeResolvedDto(id, me, result.Removed ? "Rejected" : "Declined"));
        await Clients.Group(room.Id).GameState(result.State);
    }

    public async Task CancelTrade(string offerId)
    {
        var (room, me) = CurrentActor();
        var id = ParseOfferId(offerId);

        GameStateDto state;
        try
        {
            state = room.Game.CancelTrade(me, id);
        }
        catch (GameRuleException ex)
        {
            throw new HubException(ex.Message);
        }

        await Clients.Group(room.Id).TradeResolved(new TradeResolvedDto(id, null, "Cancelled"));
        await Clients.Group(room.Id).GameState(state);
    }

    /// <summary>The caller discards their own cards after a 7.</summary>
    public Task DiscardCards(Dictionary<string, int> resourcesToDrop) =>
        ApplyMove("DiscardCards", "-", (g, me) => g.DiscardCards(me, resourcesToDrop));

    public Task BuyDevelopmentCard() =>
        ApplyMove("BuyDevelopmentCard", "deck", (g, me) => g.BuyDevelopmentCard(me));

    public Task PlayKnightCard(Guid cardId) =>
        ApplyMove("PlayKnightCard", cardId.ToString(), (g, me) => g.PlayKnightCard(me, cardId));

    public Task PlayMonopoly(Guid cardId, string resource) =>
        ApplyMove("PlayMonopoly", resource, (g, me) => g.PlayMonopoly(me, cardId, resource));

    public Task PlayYearOfPlenty(Guid cardId, string res1, string res2) =>
        ApplyMove("PlayYearOfPlenty", $"{res1}+{res2}", (g, me) => g.PlayYearOfPlenty(me, cardId, res1, res2));

    public Task PlayRoadBuilding(Guid cardId) =>
        ApplyMove("PlayRoadBuilding", cardId.ToString(), (g, me) => g.PlayRoadBuilding(me, cardId));

    public async Task MoveRobber(string hexId, string? targetPlayerId)
    {
        var (room, me) = CurrentActor();
        Guid? victim = Guid.TryParse(targetPlayerId, out var parsed) ? parsed : null;

        (RobberMovedDto Event, GameStateDto State) result;
        try
        {
            result = room.Game.MoveRobber(me, hexId, victim);
        }
        catch (GameRuleException ex)
        {
            throw new HubException(ex.Message);
        }

        await Clients.Group(room.Id).RobberMoved(result.Event);
        await Clients.Group(room.Id).GameState(result.State);
    }

    public Task PlaceInitialSettlement(string nodeId) =>
        ApplyMove("PlaceInitialSettlement", nodeId, (g, me) => g.PlaceInitialSettlement(me, nodeId));

    public Task PlaceInitialRoad(string edgeId) =>
        ApplyMove("PlaceInitialRoad", edgeId, (g, me) => g.PlaceInitialRoad(me, edgeId));

    // ---------------------------------------------------------------- Helpers

    private async Task ApplyMove(string move, string target, Func<IGameStateService, Guid, GameStateDto> action)
    {
        var (room, me) = CurrentActor();

        GameStateDto state;
        try
        {
            state = action(room.Game, me);
        }
        catch (GameRuleException ex)
        {
            _logger.LogInformation("[{RoomId}] Rejected {Move} at {Target} by {Player}: {Reason}", room.Id, move, target, me, ex.Message);
            throw new HubException(ex.Message);
        }

        _logger.LogInformation("[{RoomId}] {Move} at {Target} by {Player}", room.Id, move, target, me);
        await Clients.Group(room.Id).GameState(state);

        if (state.Phase == nameof(GamePhase.GameOver) && state.WinnerId is { } winnerId)
        {
            var winner = state.Players.First(p => p.Id == winnerId);
            await Clients.Group(room.Id).GameOver(winner);
        }
    }

    private Room CurrentRoom() =>
        _rooms.RoomFor(Context.ConnectionId) ?? throw new HubException("Join a room first.");

    /// <summary>The seat this socket authenticated as when it created/joined/rejoined.</summary>
    private Guid CurrentPlayerId() =>
        _rooms.PlayerFor(Context.ConnectionId) ?? throw new HubException("Join a room first.");

    private (Room Room, Guid PlayerId) CurrentActor()
    {
        var room = CurrentRoom();
        if (room.Status != RoomStatus.InGame)
        {
            throw new HubException("The game has not started yet.");
        }

        return (room, CurrentPlayerId());
    }

    private IGameStateService CurrentGame()
    {
        var room = CurrentRoom();
        if (room.Status != RoomStatus.InGame)
        {
            throw new HubException("The game has not started yet.");
        }

        return room.Game;
    }

    private Room RequireRoom(string roomId)
    {
        var room = CurrentRoom();
        if (!string.Equals(room.Id, RoomManager.Normalise(roomId), StringComparison.Ordinal))
        {
            throw new HubException("You are not in that room.");
        }

        return room;
    }

    private static string RequireName(string? playerName)
    {
        var name = playerName?.Trim();
        if (string.IsNullOrEmpty(name))
        {
            throw new HubException("Enter a name first.");
        }

        return name.Length > 20 ? name[..20] : name;
    }

    private static Guid ParseOfferId(string offerId) =>
        Guid.TryParse(offerId, out var id) ? id : throw new HubException("Invalid trade offer id.");
}
