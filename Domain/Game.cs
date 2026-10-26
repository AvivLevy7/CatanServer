namespace CatanServer.Domain;

public enum GamePhase
{
    SetupRound1,
    SetupRound2,
    MainGame,
    WaitingForDiscards,
    MovingRobber
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
    /// <summary>Hand size above which a 7 forces a discard of half (rounded down).</summary>
    public const int DiscardThreshold = 7;

    private readonly List<Player> _players;
    private readonly Random _random;
    private int _currentTurnIndex;

    // Setup bookkeeping: the settlement just placed, awaiting its adjoining road.
    private NodeId? _pendingSetupSettlement;

    // Robber bookkeeping: who still owes cards after a 7, and who rolled it.
    private readonly Dictionary<Guid, int> _pendingDiscards = [];
    private Guid? _robberMover;

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

    public bool IsSetup => Phase is GamePhase.SetupRound1 or GamePhase.SetupRound2;

    public Hex RobberHex => Board.Hexes.First(hex => hex.HasRobber);

    /// <summary>Players who must still discard, with the number of cards each owes.</summary>
    public IReadOnlyDictionary<Guid, int> PendingDiscards => _pendingDiscards;

    /// <summary>The player who rolled the 7 and will move the robber once discards are done.</summary>
    public Guid? RobberMover => _robberMover;

    public SetupStep SetupStep => Phase switch
    {
        GamePhase.SetupRound1 or GamePhase.SetupRound2 when _pendingSetupSettlement is null => SetupStep.PlaceSettlement,
        GamePhase.SetupRound1 or GamePhase.SetupRound2 => SetupStep.PlaceRoad,
        _ => SetupStep.None
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

    public int RoadsBuilt(Guid playerId) => Board.Edges.Count(edge => edge.OwnerId == playerId);

    public int SettlementsBuilt(Guid playerId) =>
        Board.Nodes.Count(node => node.OwnerId == playerId && node.Building == BuildingType.Settlement);

    public int CitiesBuilt(Guid playerId) =>
        Board.Nodes.Count(node => node.OwnerId == playerId && node.Building == BuildingType.City);

    public int RoadsRemaining(Guid playerId) => PieceLimits.Roads - RoadsBuilt(playerId);

    public int SettlementsRemaining(Guid playerId) => PieceLimits.Settlements - SettlementsBuilt(playerId);

    public int CitiesRemaining(Guid playerId) => PieceLimits.Cities - CitiesBuilt(playerId);

    /// <summary>
    /// Setup phase: places a free settlement for the current player. The distance rule
    /// applies. In round 2 the player immediately collects one resource per adjacent hex.
    /// </summary>
    public IReadOnlyList<ResourceGrant> PlaceInitialSettlement(Guid playerId, NodeId nodeId)
    {
        RequireTurn(playerId);
        RequireSetupStep(SetupStep.PlaceSettlement, "Place your road first.");
        RequireSettlementSupply(playerId);

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
        RequireRoadSupply(playerId);

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
        RequireSettlementSupply(playerId);

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
    /// 4:1 maritime trade with the bank. The current player gives four of one resource
    /// and receives one of another. Harbour discounts are not applied yet.
    /// </summary>
    public void TradeWithBank(Guid playerId, ResourceType give, ResourceType receive)
    {
        RequireMainGame();
        RequireTurn(playerId);

        if (give == receive)
        {
            throw new GameRuleException("Choose two different resources to trade.");
        }

        var player = GetPlayer(playerId);
        if (player.Resources[give] < TradeRates.Bank)
        {
            throw new GameRuleException($"You need {TradeRates.Bank} {give} to trade with the bank.");
        }

        player.Pay(new Dictionary<ResourceType, int> { [give] = TradeRates.Bank });
        player.AddResources(receive, 1);
    }

    /// <summary>
    /// Upgrades one of the current player's settlements to a city. Costs 3 Ore + 2 Wheat,
    /// grants +1 VP (settlement 1 -> city 2) and returns the settlement piece to supply.
    /// </summary>
    public void BuildCity(Guid playerId, NodeId nodeId)
    {
        RequireMainGame();
        RequireTurn(playerId);

        if (!Board.TryGetNode(nodeId, out var node))
        {
            throw new GameRuleException("That intersection is not on the board.");
        }

        if (node.OwnerId != playerId || node.Building != BuildingType.Settlement)
        {
            throw new GameRuleException("You can only upgrade one of your own settlements.");
        }

        if (CitiesRemaining(playerId) <= 0)
        {
            throw new GameRuleException($"You have used all {PieceLimits.Cities} of your cities.");
        }

        var player = GetPlayer(playerId);
        if (!player.CanAfford(BuildingCosts.City))
        {
            throw new GameRuleException("A city costs 3 Ore and 2 Wheat.");
        }

        player.Pay(BuildingCosts.City);
        node.Occupy(playerId, BuildingType.City);

        var gained = new Building(nodeId, playerId, BuildingType.City).VictoryPoints
                   - new Building(nodeId, playerId, BuildingType.Settlement).VictoryPoints;
        player.AwardVictoryPoints(gained);
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
        RequireRoadSupply(playerId);

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

        if (roll.ActivatesRobber)
        {
            BeginRobberSequence(roller);
            return new RollOutcome(roller, roll, []);
        }

        var production = DistributeResources(roll.Total);
        AdvanceTurn();

        return new RollOutcome(roller, roll, production);
    }

    /// <summary>
    /// Removes the given cards from a player who owes a discard. When everyone has
    /// discarded, the phase moves on to <see cref="GamePhase.MovingRobber"/>.
    /// </summary>
    public void DiscardCards(Guid playerId, IReadOnlyDictionary<ResourceType, int> cards)
    {
        if (Phase != GamePhase.WaitingForDiscards)
        {
            throw new GameRuleException("Nobody needs to discard right now.");
        }

        if (!_pendingDiscards.TryGetValue(playerId, out var owed))
        {
            throw new GameRuleException("You do not need to discard.");
        }

        if (cards.Values.Any(amount => amount < 0))
        {
            throw new GameRuleException("Discard amounts cannot be negative.");
        }

        var total = cards.Values.Sum();
        if (total != owed)
        {
            throw new GameRuleException($"You must discard exactly {owed} cards.");
        }

        var player = GetPlayer(playerId);
        if (!player.CanAfford(cards))
        {
            throw new GameRuleException("You do not hold those cards.");
        }

        player.Pay(cards);
        _pendingDiscards.Remove(playerId);

        if (_pendingDiscards.Count == 0)
        {
            Phase = GamePhase.MovingRobber;
        }
    }

    /// <summary>
    /// Moves the robber to a new hex and steals one random card from an adjacent
    /// opponent (if any). Resumes the main game and passes the turn.
    /// </summary>
    public ResourceGrant? MoveRobber(Guid playerId, AxialCoordinate target, Guid? victimId)
    {
        if (Phase != GamePhase.MovingRobber)
        {
            throw new GameRuleException("The robber cannot be moved right now.");
        }

        if (playerId != _robberMover)
        {
            throw new GameRuleException("Only the player who rolled the 7 may move the robber.");
        }

        var hex = Board.GetHex(target)
            ?? throw new GameRuleException("That tile is not on the board.");

        if (hex.HasRobber)
        {
            throw new GameRuleException("The robber must move to a different tile.");
        }

        var candidates = StealCandidates(hex, playerId);

        ResourceGrant? stolen = null;
        if (candidates.Count > 0)
        {
            if (victimId is null)
            {
                throw new GameRuleException("Choose a player to steal from.");
            }

            if (!candidates.Contains(victimId.Value))
            {
                throw new GameRuleException("That player has no building next to that tile.");
            }

            stolen = StealRandomCard(from: GetPlayer(victimId.Value), to: GetPlayer(playerId));
        }

        RobberHex.HasRobber = false;
        hex.HasRobber = true;

        _robberMover = null;
        Phase = GamePhase.MainGame;
        AdvanceTurn();

        return stolen;
    }

    /// <summary>Opponents with a building on <paramref name="hex"/> who hold at least one card.</summary>
    public IReadOnlyCollection<Guid> StealCandidates(Hex hex, Guid thief) =>
        hex.Nodes
            .Select(Board.GetNode)
            .Where(node => node.IsOccupied && node.OwnerId != thief)
            .Select(node => node.OwnerId!.Value)
            .Distinct()
            .Where(id => GetPlayer(id).TotalResourceCount > 0)
            .ToArray();

    private void BeginRobberSequence(Guid roller)
    {
        _robberMover = roller;
        _pendingDiscards.Clear();

        foreach (var player in _players)
        {
            var hand = player.TotalResourceCount;
            if (hand > DiscardThreshold)
            {
                _pendingDiscards[player.Id] = hand / 2;
            }
        }

        Phase = _pendingDiscards.Count > 0 ? GamePhase.WaitingForDiscards : GamePhase.MovingRobber;
    }

    private ResourceGrant? StealRandomCard(Player from, Player to)
    {
        // Weight by count so each physical card is equally likely.
        var pool = from.Resources
            .SelectMany(pair => Enumerable.Repeat(pair.Key, pair.Value))
            .ToArray();

        if (pool.Length == 0)
        {
            return null;
        }

        var resource = pool[_random.Next(pool.Length)];
        from.Pay(new Dictionary<ResourceType, int> { [resource] = 1 });
        to.AddResources(resource, 1);
        return new ResourceGrant(to.Id, resource, 1);
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
        if (Phase != GamePhase.MainGame)
        {
            throw new GameRuleException(Phase switch
            {
                GamePhase.WaitingForDiscards => "Waiting for players to discard.",
                GamePhase.MovingRobber => "The robber must be moved first.",
                _ => "Finish the setup phase first."
            });
        }
    }

    private void RequireRoadSupply(Guid playerId)
    {
        if (RoadsRemaining(playerId) <= 0)
        {
            throw new GameRuleException($"You have used all {PieceLimits.Roads} of your roads.");
        }
    }

    private void RequireSettlementSupply(Guid playerId)
    {
        if (SettlementsRemaining(playerId) <= 0)
        {
            throw new GameRuleException($"You have used all {PieceLimits.Settlements} of your settlements.");
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
