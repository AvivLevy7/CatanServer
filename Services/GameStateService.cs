using CatanServer.Contracts;
using CatanServer.Domain;

namespace CatanServer.Services;

public interface IGameStateService
{
    Guid BoardId { get; }

    BoardGraph Board { get; }

    BoardStateDto GetBoardState();

    BoardStateDto ResetBoard();
}

/// <summary>
/// Holds the single in-memory board for local multiplayer. Registered as a singleton,
/// so every member must be safe to call from concurrent SignalR connections.
/// </summary>
public sealed class GameStateService : IGameStateService
{
    private const int Radius = 2;

    // Guards swapping the board; reads take a snapshot reference so they never tear.
    private readonly Lock _gate = new();

    private BoardSnapshot _snapshot;

    public GameStateService()
    {
        _snapshot = CreateSnapshot();
    }

    public Guid BoardId => Volatile.Read(ref _snapshot).Id;

    public BoardGraph Board => Volatile.Read(ref _snapshot).Board;

    public BoardStateDto GetBoardState() => Volatile.Read(ref _snapshot).Dto;

    public BoardStateDto ResetBoard()
    {
        lock (_gate)
        {
            var snapshot = CreateSnapshot();
            Volatile.Write(ref _snapshot, snapshot);
            return snapshot.Dto;
        }
    }

    private static BoardSnapshot CreateSnapshot()
    {
        var board = BoardFactory.CreateStandardBoard();
        var id = Guid.NewGuid();
        return new BoardSnapshot(id, board, Project(id, board));
    }

    /// <summary>
    /// Projects the domain graph to the wire format, adding the row/col indices that
    /// match the client's 3-4-5-4-3 rendering order.
    /// </summary>
    private static BoardStateDto Project(Guid id, BoardGraph board)
    {
        var hexes = board.Hexes
            .OrderBy(hex => hex.Coordinate.R)
            .ThenBy(hex => hex.Coordinate.Q)
            .Select(hex =>
            {
                var r = hex.Coordinate.R;
                var qMin = Math.Max(-Radius, -r - Radius);
                var qMax = Math.Min(Radius, -r + Radius);

                return new HexDto(
                    hex.Coordinate.Q,
                    r,
                    Row: r + Radius,
                    Col: hex.Coordinate.Q - qMin,
                    RowLength: qMax - qMin + 1,
                    Type: hex.Type.ToString(),
                    NumberToken: hex.NumberToken,
                    HasRobber: hex.HasRobber);
            })
            .ToList();

        return new BoardStateDto(id, hexes);
    }

    private sealed record BoardSnapshot(Guid Id, BoardGraph Board, BoardStateDto Dto);
}
