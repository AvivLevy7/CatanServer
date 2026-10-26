namespace CatanServer.Domain;

public enum GamePhase
{
    SetupRound1,
    SetupRound2,
    MainGame
}

/// <summary>What the current player must do next during setup.</summary>
public enum SetupStep
{
    None,
    PlaceSettlement,
    PlaceRoad
}

/// <summary>
/// Aggregate root for one match. All mutations go through here so invariants
/// (turn order, building ownership, resource accounting) are enforced in one place.
/// Not thread-safe by itself; the hosting service serialises access.
/// </summary>
public sealed class Game
{
    private readonly List<Player> _players;
    private readonly Random _random;
    private int _currentTurnIndex;

    // Setup bookkeeping: the settlement just placed, awaiting its adjoining road.
    private NodeId? _pendingSetupSettlement;

    public Game(Guid id, BoardGraph board, IReadOnlyList<Player> players, Random? random = null)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(players.Count, 2);

        Id = id;
        Board = board;
        _players = [.. players];
        _random = random ?? Random.Shared;
    }

    public Guid Id { get; }

    public BoardGraph Board { get; }

    public GamePhase Phase { get; private set; } = GamePhase.SetupRound1;

    public bool IsSetup => Phase != GamePhase.MainGame;

    public SetupStep SetupStep => Phase switch
    {
        GamePhase.MainGame => SetupStep.None,
        _ when _pendingSetupSettlement is null => SetupStep.PlaceSettlement,
        _ => SetupStep.PlaceRoad
    };

    /// <summary>The settlement the current player must attach their setup road to.</summary>
    public NodeId? PendingSetupSettlement => _pendingSetupSettlement;

    public IReadOnlyList<Player> Players => _players;

    public IEnumerable<Building> Buildings => Board.Nodes
        .Where(node => node.IsOccupied)
        .Select(node => new Building(node.Id, node.OwnerId!.Value, node.Building));

    public IEnumerable<Road> Roads => Board.Edges
        .Where(edge => edge.HasRoad)
        .Select(edge => new Road(edge.Id, edge.OwnerId!.Value));

    public Player CurrentPlayer => _players[_currentTurnIndex];

    public Guid CurrentTurnPlayerId => CurrentPlayer.Id;

    public DiceRoll? LastRoll { get; private set; }

    public Player GetPlayer(Guid playerId) =>
        _players.FirstOrDefault(player => player.Id == playerId)
        ?? throw new KeyNotFoundException($"Player {playerId} is not in this game.");

    /// <summary>
    /// Setup phase: places a free settlement for the current player. The distance rule
    /// applies. In round 2 the player immediately collects one resource per adjacent hex.
    /// </summary>
    public IReadOnlyList<ResourceGrant> PlaceInitialSettlement(Guid playerId, NodeId nodeId)
    {
        RequireTurn(playerId);
        RequireSetupStep(SetupStep.PlaceSettlement, "Place your road first.");

        var node = RequireVacantNodeRespectingDistance(nodeId);
        var player = GetPlayer(playerId);

        node.Occupy(playerId, BuildingType.Settlement);
        player.AwardVictoryPoints(new Building(nodeId, playerId, BuildingType.Settlement).VictoryPoints);
        _pendingSetupSettlement = nodeId;

        if (Phase != GamePhase.SetupRound2)
        {
            return [];
        }

        var grants = new List<ResourceGrant>();
        foreach (var hexCoordinate in node.Hexes)
        {
            if (Board.GetHex(hexCoordinate)?.Produces is { } resource)
            {
                player.AddResources(resource, 1);
                grants.Add(new ResourceGrant(playerId, resource, 1));
            }
        }

        return grants;
    }

    /// <summary>
    /// Setup phase: places a free road touching the settlement just placed, then advances
    /// the snake draft. Entering MainGame when the draft completes.
    /// </summary>
    public void PlaceInitialRoad(Guid playerId, EdgeId edgeId)
    {
        RequireTurn(playerId);
        RequireSetupStep(SetupStep.PlaceRoad, "Place your settlement first.");

        if (!Board.TryGetEdge(edgeId, out var edge))
        {
            throw new GameRuleException("That path is not on the board.");
        }

        if (edge.HasRoad)
        {
            throw new GameRuleException("That path already has a road.");
        }

        var anchor = _pendingSetupSettlement!.Value;
        if (!edge.First.Equals(anchor) && !edge.Second.Equals(anchor))
        {
            throw new GameRuleException("Your starting road must touch the settlement you just placed.");
        }

        edge.PlaceRoad(playerId);
        _pendingSetupSettlement = null;
        AdvanceSetupDraft();
    }

    /// <summary>
    /// Builds a settlement for the current player, enforcing turn order, cost,
    /// vacancy, the distance rule, and connection to one of the player's own roads.
    /// </summary>
    public void BuildSettlement(Guid playerId, NodeId nodeId)
    {
        RequireMainGame();
        RequireTurn(playerId);

        var node = RequireVacantNodeRespectingDistance(nodeId);

        if (!node.Edges.Any(edgeId => Board.GetEdge(edgeId).OwnerId == playerId))
        {
            throw new GameRuleException("A settlement must connect to one of your roads.");
        }

        var player = GetPlayer(playerId);
        if (!player.CanAfford(BuildingCosts.Settlement))
        {
            throw new GameRuleException("A settlement costs 1 Wood, 1 Brick, 1 Wheat and 1 Sheep.");
        }

        player.Pay(BuildingCosts.Settlement);
        node.Occupy(playerId, BuildingType.Settlement);
        player.AwardVictoryPoints(new Building(nodeId, playerId, BuildingType.Settlement).VictoryPoints);
    }

    /// <summary>
    /// Builds a road for the current player. The edge must be empty and connect to one
    /// of the player's existing roads or buildings, without passing through an
    /// opponent's building at the shared intersection.
    /// </summary>
    public void BuildRoad(Guid playerId, EdgeId edgeId)
    {
        RequireMainGame();
        RequireTurn(playerId);

        if (!Board.TryGetEdge(edgeId, out var edge))
        {
            throw new GameRuleException("That path is not on the board.");
        }

        if (edge.HasRoad)
        {
            throw new GameRuleException("That path already has a road.");
        }

        if (!IsConnectedForRoad(playerId, edge, edge.First) && !IsConnectedForRoad(playerId, edge, edge.Second))
        {
            throw new GameRuleException("A road must connect to one of your roads or settlements.");
        }

        var player = GetPlayer(playerId);
        if (!player.CanAfford(BuildingCosts.Road))
        {
            throw new GameRuleException("A road costs 1 Wood and 1 Brick.");
        }

        player.Pay(BuildingCosts.Road);
        edge.PlaceRoad(playerId);
    }

    /// <summary>
    /// True when the player may extend a road through <paramref name="nodeId"/>: either
    /// they own a building there, or the node is unoccupied and they own another road touching it.
    /// </summary>
    private bool IsConnectedForRoad(Guid playerId, Edge edge, NodeId nodeId)
    {
        var node = Board.GetNode(nodeId);

        if (node.IsOccupied)
        {
            return node.OwnerId == playerId;
        }

        return node.Edges.Any(otherId =>
            !otherId.Equals(edge.Id) && Board.GetEdge(otherId).OwnerId == playerId);
    }

    /// <summary>Places a building directly, bypassing cost and the distance rule. Used for setup and tests.</summary>
    public void PlaceBuilding(NodeId nodeId, Guid ownerId, BuildingType type)
    {
        if (type == BuildingType.None)
        {
            throw new ArgumentException("Cannot place an empty building.", nameof(type));
        }

        if (!Board.TryGetNode(nodeId, out var node))
        {
            throw new ArgumentException($"Node {nodeId} is not on the board.", nameof(nodeId));
        }

        var owner = GetPlayer(ownerId);

        if (node.IsOccupied && node.OwnerId != ownerId)
        {
            throw new InvalidOperationException($"Node {nodeId} is owned by another player.");
        }

        if (node.Building == type)
        {
            throw new InvalidOperationException($"Node {nodeId} already holds a {type}.");
        }

        var previousPoints = node.IsOccupied ? new Building(nodeId, ownerId, node.Building).VictoryPoints : 0;
        node.Occupy(ownerId, type);
        owner.AwardVictoryPoints(new Building(nodeId, ownerId, type).VictoryPoints - previousPoints);
    }

    /// <summary>Places a road directly, bypassing cost and connectivity rules. Used for setup and tests.</summary>
    public void PlaceRoad(EdgeId edgeId, Guid ownerId)
    {
        if (!Board.TryGetEdge(edgeId, out var edge))
        {
            throw new ArgumentException($"Edge {edgeId} is not on the board.", nameof(edgeId));
        }

        GetPlayer(ownerId);

        if (edge.HasRoad)
        {
            throw new InvalidOperationException($"Edge {edgeId} already has a road.");
        }

        edge.PlaceRoad(ownerId);
    }

    /// <summary>
    /// Rolls the dice for the current player, distributes production, and passes the
    /// turn to the next player. Each player gets exactly one roll per turn.
    /// The robber (a roll of 7) is not handled yet.
    /// </summary>
    public RollOutcome RollDice()
    {
        RequireMainGame();

        var roller = CurrentTurnPlayerId;
        var roll = DiceRoll.Roll(_random);
        LastRoll = roll;

        var production = roll.ActivatesRobber
            ? []
            : DistributeResources(roll.Total);

        AdvanceTurn();

        return new RollOutcome(roller, roll, production);
    }

    public Player EndTurn()
    {
        RequireMainGame();
        AdvanceTurn();
        return CurrentPlayer;
    }

    private void AdvanceTurn() =>
        _currentTurnIndex = (_currentTurnIndex + 1) % _players.Count;

    /// <summary>
    /// Snake draft: round 1 runs forward and stays on the last player for round 2,
    /// which runs backward and ends on the first player. Then MainGame begins with player 1.
    /// </summary>
    private void AdvanceSetupDraft()
    {
        var last = _players.Count - 1;

        switch (Phase)
        {
            case GamePhase.SetupRound1 when _currentTurnIndex < last:
                _currentTurnIndex++;
                break;

            case GamePhase.SetupRound1:
                Phase = GamePhase.SetupRound2;
                break;

            case GamePhase.SetupRound2 when _currentTurnIndex > 0:
                _currentTurnIndex--;
                break;

            case GamePhase.SetupRound2:
                Phase = GamePhase.MainGame;
                _currentTurnIndex = 0;
                break;
        }
    }

    private void RequireTurn(Guid playerId)
    {
        if (playerId != CurrentTurnPlayerId)
        {
            throw new GameRuleException("It is not your turn.");
        }
    }

    private void RequireMainGame()
    {
        if (IsSetup)
        {
            throw new GameRuleException("Finish the setup phase first.");
        }
    }

    private void RequireSetupStep(SetupStep expected, string message)
    {
        if (!IsSetup)
        {
            throw new GameRuleException("The setup phase is over.");
        }

        if (SetupStep != expected)
        {
            throw new GameRuleException(message);
        }
    }

    private Node RequireVacantNodeRespectingDistance(NodeId nodeId)
    {
        if (!Board.TryGetNode(nodeId, out var node))
        {
            throw new GameRuleException("That intersection is not on the board.");
        }

        if (node.IsOccupied)
        {
            throw new GameRuleException("That intersection is already occupied.");
        }

        if (node.Neighbors.Any(neighborId => Board.GetNode(neighborId).IsOccupied))
        {
            throw new GameRuleException("Settlements must be at least two paths apart.");
        }

        return node;
    }

    private IReadOnlyList<ResourceGrant> DistributeResources(int total)
    {
        var grants = new List<ResourceGrant>();

        foreach (var hex in Board.HexesWithToken(total))
        {
            if (hex.HasRobber || hex.Produces is not { } resource)
            {
                continue;
            }

            foreach (var nodeId in hex.Nodes)
            {
                var node = Board.GetNode(nodeId);
                if (!node.IsOccupied)
                {
                    continue;
                }

                var building = new Building(nodeId, node.OwnerId!.Value, node.Building);
                GetPlayer(building.OwnerId).AddResources(resource, building.Yield);
                grants.Add(new ResourceGrant(building.OwnerId, resource, building.Yield));
            }
        }

        return grants;
    }
}

/// <summary>Resources handed to one player from a single hex during production.</summary>
public sealed record ResourceGrant(Guid PlayerId, ResourceType Resource, int Amount);

/// <summary>Everything that happened as a result of one dice roll.</summary>
public sealed record RollOutcome(Guid RolledBy, DiceRoll Roll, IReadOnlyList<ResourceGrant> Production);
