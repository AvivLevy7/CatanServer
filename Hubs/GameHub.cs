using CatanServer.Contracts;
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

    /// <summary>Regenerates the board and broadcasts it to everyone.</summary>
    public async Task ResetBoard()
    {
        var board = _gameState.ResetBoard();
        _logger.LogInformation("Board reset to {BoardId} by {ConnectionId}", board.BoardId, Context.ConnectionId);

        await Clients.All.BoardState(board);
    }
}
