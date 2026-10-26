using CatanServer.Contracts;
using CatanServer.Domain;
using CatanServer.Services;
using Microsoft.AspNetCore.SignalR;

namespace CatanServer.Hubs;

/// <summary>
/// Real-time entry point for the board. Server-authoritative: clients request state
/// and the hub broadcasts it, rather than clients pushing state to each other.
/// </summary>
public sealed class GameHub : Hub<IGameClient>
{
    public const string Route = "/hubs/game";

    private readonly IGameStateService _gameState;
    private readonly ILogger<GameHub> _logger;

    public GameHub(IGameStateService gameState, ILogger<GameHub> logger)
    {
        _gameState = gameState;
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Client {ConnectionId} connected", Context.ConnectionId);

        // Push the current board immediately so a fresh client renders without a round trip.
        await Clients.Caller.BoardState(_gameState.GetBoardState());
        await Clients.Caller.GameState(_gameState.GetGameState());
        await Clients.Others.PlayerJoined(Context.ConnectionId);

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Client {ConnectionId} disconnected", Context.ConnectionId);

        await Clients.Others.PlayerLeft(Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>Explicit fetch, e.g. after the client reconnects.</summary>
    public BoardStateDto GetBoardState() => _gameState.GetBoardState();

    public GameStateDto GetGameState() => _gameState.GetGameState();

    /// <summary>Regenerates the board (and a fresh game) and broadcasts both to everyone.</summary>
    public async Task ResetBoard()
    {
        var board = _gameState.ResetBoard();
        _logger.LogInformation("Board reset to {BoardId} by {ConnectionId}", board.BoardId, Context.ConnectionId);

        await Clients.All.BoardState(board);
        await Clients.All.GameState(_gameState.GetGameState());
    }

    /// <summary>
    /// Rolls the dice for the current player, distributes production, and broadcasts
    /// the roll event followed by the authoritative game state.
    /// </summary>
    public async Task ClientRollDice()
    {
        (DiceRolledDto Roll, GameStateDto State) result;
        try
        {
            result = _gameState.RollDice();
        }
        catch (GameRuleException ex)
        {
            throw new HubException(ex.Message);
        }

        var (roll, state) = result;
        _logger.LogInformation(
            "{ConnectionId} rolled {First}+{Second}={Total}; {Grants} resource grant(s)",
            Context.ConnectionId, roll.Roll.First, roll.Roll.Second, roll.Roll.Total, roll.Production.Count);

        await Clients.All.DiceRolled(roll);
        await Clients.All.GameState(state);
    }

    /// <summary>Advances to the next player and broadcasts the new state.</summary>
    public async Task EndTurn()
    {
        var state = _gameState.EndTurn();
        await Clients.All.GameState(state);
    }

    /// <summary>
    /// Builds a settlement on <paramref name="nodeId"/> for the current player.
    /// Rule violations are returned to the caller as a <see cref="HubException"/>
    /// so the client promise rejects with a readable message.
    /// </summary>
    /// <summary>Starts a new game with 3 or 4 players on a fresh board and broadcasts it.</summary>
    public async Task StartGame(int playerCount)
    {
        GameStateDto state;
        try
        {
            state = _gameState.StartGame(playerCount);
        }
        catch (GameRuleException ex)
        {
            throw new HubException(ex.Message);
        }

        _logger.LogInformation("New {Count}-player game {GameId} started by {ConnectionId}", playerCount, state.GameId, Context.ConnectionId);

        await Clients.All.BoardState(state.Board);
        await Clients.All.GameState(state);
    }

    public Task BuildSettlement(string nodeId) =>
        ApplyMove("BuildSettlement", nodeId, () => _gameState.BuildSettlement(nodeId));

    public Task BuildRoad(string edgeId) =>
        ApplyMove("BuildRoad", edgeId, () => _gameState.BuildRoad(edgeId));

    /// <summary>Setup phase: place a free settlement for the current player.</summary>
    public Task PlaceInitialSettlement(string nodeId) =>
        ApplyMove("PlaceInitialSettlement", nodeId, () => _gameState.PlaceInitialSettlement(nodeId));

    /// <summary>Setup phase: place a free road next to the settlement just placed.</summary>
    public Task PlaceInitialRoad(string edgeId) =>
        ApplyMove("PlaceInitialRoad", edgeId, () => _gameState.PlaceInitialRoad(edgeId));

    /// <summary>
    /// Runs a rule-checked move and broadcasts the resulting state. Rule violations
    /// surface to the caller as a <see cref="HubException"/> so the client promise
    /// rejects with a readable message.
    /// </summary>
    private async Task ApplyMove(string move, string target, Func<GameStateDto> action)
    {
        GameStateDto state;
        try
        {
            state = action();
        }
        catch (GameRuleException ex)
        {
            _logger.LogInformation("Rejected {Move} at {Target}: {Reason}", move, target, ex.Message);
            throw new HubException(ex.Message);
        }

        _logger.LogInformation("{Move} at {Target} by {ConnectionId}", move, target, Context.ConnectionId);
        await Clients.All.GameState(state);
    }
}
