using CatanServer.Contracts;
using CatanServer.Domain;

namespace CatanServer.Services;

public interface IGameStateService
{
    Guid BoardId { get; }

    BoardGraph Board { get; }

    BoardStateDto GetBoardState();

    BoardStateDto ResetBoard();

    GameStateDto GetGameState();

    /// <summary>Rolls for the current player, distributes production and returns both the event and the new state.</summary>
    (DiceRolledDto Roll, GameStateDto State) RollDice();

    GameStateDto EndTurn();

    /// <summary>Builds a settlement for the current player. Throws <see cref="GameRuleException"/> on an illegal move.</summary>
    GameStateDto BuildSettlement(string nodeId);

    /// <summary>Builds a road for the current player. Throws <see cref="GameRuleException"/> on an illegal move.</summary>
    GameStateDto BuildRoad(string edgeId);

    /// <summary>Upgrades the current player's settlement to a city. Throws <see cref="GameRuleException"/> on an illegal move.</summary>
    GameStateDto BuildCity(string nodeId);

    /// <summary>4:1 bank trade for the current player. Throws <see cref="GameRuleException"/> on an illegal trade.</summary>
    GameStateDto TradeWithBank(string resourceToGive, string resourceToReceive);

    /// <summary>After a 7: a player discards the cards they owe.</summary>
    GameStateDto DiscardCards(Guid playerId, IReadOnlyDictionary<string, int> cards);

    /// <summary>After a 7: the roller moves the robber and optionally steals from an adjacent opponent.</summary>
    (RobberMovedDto Event, GameStateDto State) MoveRobber(string hexId, Guid? victimId);

    /// <summary>Opponents the current robber-mover could steal from if the robber landed on <paramref name="hexId"/>.</summary>
    IReadOnlyList<Guid> GetStealCandidates(string hexId);

    /// <summary>Setup phase: free settlement for the current player.</summary>
    GameStateDto PlaceInitialSettlement(string nodeId);

    /// <summary>Setup phase: free road attached to the settlement just placed.</summary>
    GameStateDto PlaceInitialRoad(string edgeId);

    /// <summary>Starts a fresh game on a new board with the given number of seats (3 or 4).</summary>
    GameStateDto StartGame(int playerCount);
}

/// <summary>
/// Holds the single in-memory game for local multiplayer. Registered as a singleton,
/// so every member must be safe to call from concurrent SignalR connections.
/// </summary>
public sealed class GameStateService : IGameStateService
{
    private const int Radius = 2;

    public const int MinPlayers = 3;
    public const int MaxPlayers = 4;

    private static readonly (string Name, PlayerColor Color)[] DefaultSeats =
    [
        ("Player 1", PlayerColor.Red),
        ("Player 2", PlayerColor.Blue),
        ("Player 3", PlayerColor.Orange),
        ("Player 4", PlayerColor.White)
    ];

    // Serialises every mutation of the aggregate. Board reads take a snapshot reference
    // so they never tear; game reads lock because the aggregate is mutable.
    private readonly Lock _gate = new();

    private BoardSnapshot _snapshot;
    private Game _game;
    private int _playerCount = MaxPlayers;

    public GameStateService()
    {
        _snapshot = CreateSnapshot();
        _game = CreateGame(_snapshot, _playerCount);
    }

    public Guid BoardId => Volatile.Read(ref _snapshot).Id;

    public BoardGraph Board => Volatile.Read(ref _snapshot).Board;

    public BoardStateDto GetBoardState()
    {
        lock (_gate)
        {
            return Project(_snapshot.Id, _snapshot.Board);
        }
    }

    public BoardStateDto ResetBoard()
    {
        lock (_gate)
        {
            var snapshot = CreateSnapshot();
            Volatile.Write(ref _snapshot, snapshot);
            _game = CreateGame(snapshot, _playerCount);
            return Project(snapshot.Id, snapshot.Board);
        }
    }

    public GameStateDto StartGame(int playerCount)
    {
        if (playerCount is < MinPlayers or > MaxPlayers)
        {
            throw new GameRuleException($"Choose between {MinPlayers} and {MaxPlayers} players.");
        }

        lock (_gate)
        {
            _playerCount = playerCount;
            var snapshot = CreateSnapshot();
            Volatile.Write(ref _snapshot, snapshot);
            _game = CreateGame(snapshot, playerCount);
            return ProjectGame(_game);
        }
    }

    public GameStateDto GetGameState()
    {
        lock (_gate)
        {
            return ProjectGame(_game);
        }
    }

    public (DiceRolledDto Roll, GameStateDto State) RollDice()
    {
        lock (_gate)
        {
            var outcome = _game.RollDice();
            return (ProjectRoll(outcome), ProjectGame(_game));
        }
    }

    public GameStateDto EndTurn()
    {
        lock (_gate)
        {
            _game.EndTurn();
            return ProjectGame(_game);
        }
    }

    public GameStateDto BuildSettlement(string nodeId)
    {
        lock (_gate)
        {
            var node = _game.Board.FindNode(nodeId)
                ?? throw new GameRuleException("That intersection is not on the board.");

            _game.BuildSettlement(_game.CurrentTurnPlayerId, node.Id);
            return ProjectGame(_game);
        }
    }

    public GameStateDto BuildRoad(string edgeId)
    {
        lock (_gate)
        {
            var edge = _game.Board.FindEdge(edgeId)
                ?? throw new GameRuleException("That path is not on the board.");

            _game.BuildRoad(_game.CurrentTurnPlayerId, edge.Id);
            return ProjectGame(_game);
        }
    }

    public GameStateDto BuildCity(string nodeId)
    {
        lock (_gate)
        {
            var node = _game.Board.FindNode(nodeId)
                ?? throw new GameRuleException("That intersection is not on the board.");

            _game.BuildCity(_game.CurrentTurnPlayerId, node.Id);
            return ProjectGame(_game);
        }
    }

    public GameStateDto TradeWithBank(string resourceToGive, string resourceToReceive)
    {
        var give = ParseResource(resourceToGive);
        var receive = ParseResource(resourceToReceive);

        lock (_gate)
        {
            _game.TradeWithBank(_game.CurrentTurnPlayerId, give, receive);
            return ProjectGame(_game);
        }
    }

    private static ResourceType ParseResource(string name) =>
        Enum.TryParse<ResourceType>(name, ignoreCase: true, out var resource)
            ? resource
            : throw new GameRuleException($"'{name}' is not a resource.");

    public GameStateDto DiscardCards(Guid playerId, IReadOnlyDictionary<string, int> cards)
    {
        var parsed = cards
            .Where(pair => pair.Value != 0)
            .ToDictionary(pair => ParseResource(pair.Key), pair => pair.Value);

        lock (_gate)
        {
            _game.DiscardCards(playerId, parsed);
            return ProjectGame(_game);
        }
    }

    public (RobberMovedDto Event, GameStateDto State) MoveRobber(string hexId, Guid? victimId)
    {
        var target = ParseHexId(hexId);

        lock (_gate)
        {
            var mover = _game.RobberMover
                ?? throw new GameRuleException("The robber cannot be moved right now.");

            var stolen = _game.MoveRobber(mover, target, victimId);
            var evt = new RobberMovedDto(mover, hexId, victimId, stolen?.Resource.ToString());
            return (evt, ProjectGame(_game));
        }
    }

    public IReadOnlyList<Guid> GetStealCandidates(string hexId)
    {
        var target = ParseHexId(hexId);

        lock (_gate)
        {
            var mover = _game.RobberMover ?? _game.CurrentTurnPlayerId;
            var hex = _game.Board.GetHex(target)
                ?? throw new GameRuleException("That tile is not on the board.");
            return _game.StealCandidates(hex, mover).ToList();
        }
    }

    private static AxialCoordinate ParseHexId(string hexId)
    {
        var parts = hexId.Split(',');
        if (parts.Length == 2 && int.TryParse(parts[0], out var q) && int.TryParse(parts[1], out var r))
        {
            return new AxialCoordinate(q, r);
        }

        throw new GameRuleException($"'{hexId}' is not a tile.");
    }

    public GameStateDto PlaceInitialSettlement(string nodeId)
    {
        lock (_gate)
        {
            var node = _game.Board.FindNode(nodeId)
                ?? throw new GameRuleException("That intersection is not on the board.");

            _game.PlaceInitialSettlement(_game.CurrentTurnPlayerId, node.Id);
            return ProjectGame(_game);
        }
    }

    public GameStateDto PlaceInitialRoad(string edgeId)
    {
        lock (_gate)
        {
            var edge = _game.Board.FindEdge(edgeId)
                ?? throw new GameRuleException("That path is not on the board.");

            _game.PlaceInitialRoad(_game.CurrentTurnPlayerId, edge.Id);
            return ProjectGame(_game);
        }
    }

    private static BoardSnapshot CreateSnapshot() =>
        new(Guid.NewGuid(), BoardFactory.CreateStandardBoard());

    private static Game CreateGame(BoardSnapshot snapshot, int playerCount)
    {
        var players = DefaultSeats
            .Take(playerCount)
            .Select(seat => new Player(Guid.NewGuid(), seat.Name, seat.Color))
            .ToArray();

        return new Game(snapshot.Id, snapshot.Board, players);
    }

    private static GameStateDto ProjectGame(Game game)
    {
        var players = game.Players
            .Select(player => new PlayerDto(
                player.Id,
                player.Name,
                player.Color.ToString(),
                player.VictoryPoints,
                player.Resources.ToDictionary(pair => pair.Key.ToString(), pair => pair.Value),
                game.RoadsRemaining(player.Id),
                game.SettlementsRemaining(player.Id),
                game.CitiesRemaining(player.Id)))
            .ToList();

        var buildings = game.Buildings
            .Select(building => new BuildingDto(building.Node.ToString(), building.OwnerId, building.Type.ToString()))
            .ToList();

        var roads = game.Roads
            .Select(road => new RoadDto(road.Edge.ToString(), road.OwnerId))
            .ToList();

        return new GameStateDto(
            game.Id,
            Project(game.Id, game.Board),
            players,
            buildings,
            roads,
            game.CurrentTurnPlayerId,
            game.LastRoll is { } roll ? ProjectRoll(roll) : null,
            game.Phase.ToString(),
            game.SetupStep.ToString(),
            game.PendingSetupSettlement?.ToString(),
            $"{game.RobberHex.Coordinate.Q},{game.RobberHex.Coordinate.R}",
            game.RobberMover,
            game.PendingDiscards.ToDictionary(pair => pair.Key, pair => pair.Value));
    }

    private static DiceRolledDto ProjectRoll(RollOutcome outcome) =>
        new(
            outcome.RolledBy,
            ProjectRoll(outcome.Roll),
            outcome.Production
                .Select(grant => new ResourceGrantDto(grant.PlayerId, grant.Resource.ToString(), grant.Amount))
                .ToList());

    private static DiceRollDto ProjectRoll(DiceRoll roll) => new(roll.First, roll.Second, roll.Total);

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

        var nodes = board.Nodes
            .Select(node => new NodeDto(
                node.Id.ToString(),
                AnchorHexId: $"{node.AnchorHex.Q},{node.AnchorHex.R}",
                AnchorCorner: node.AnchorCorner.ToString(),
                node.OwnerId,
                node.Building.ToString()))
            .ToList();

        var edges = board.Edges
            .Select(edge => new EdgeDto(
                edge.Id.ToString(),
                edge.First.ToString(),
                edge.Second.ToString(),
                edge.OwnerId))
            .ToList();

        return new BoardStateDto(id, hexes, nodes, edges);
    }

    private sealed record BoardSnapshot(Guid Id, BoardGraph Board);
}
