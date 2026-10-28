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

    /// <summary>Rolls for <paramref name="actorId"/> (must be the current player).</summary>
    (DiceRolledDto Roll, GameStateDto State) RollDice(Guid actorId);

    GameStateDto EndTurn(Guid actorId);

    GameStateDto BuildSettlement(Guid actorId, string nodeId);

    GameStateDto BuildRoad(Guid actorId, string edgeId);

    GameStateDto BuildCity(Guid actorId, string nodeId);

    GameStateDto TradeWithBank(Guid actorId, string resourceToGive, string resourceToReceive);

    (TradeOfferDto Offer, GameStateDto State) ProposeTrade(Guid actorId, Guid? targetPlayerId, IReadOnlyDictionary<string, int> offered, IReadOnlyDictionary<string, int> requested);

    (TradeOfferDto Offer, GameStateDto State) AcceptTrade(Guid actorId, Guid offerId);

    (TradeOfferDto Offer, bool Removed, GameStateDto State) RejectTrade(Guid actorId, Guid offerId);

    GameStateDto CancelTrade(Guid actorId, Guid offerId);

    /// <summary>After a 7: the actor discards the cards they owe.</summary>
    GameStateDto DiscardCards(Guid actorId, IReadOnlyDictionary<string, int> cards);

    /// <summary>After a 7 or a Knight: the actor (must be the robber mover) moves the robber.</summary>
    (RobberMovedDto Event, GameStateDto State) MoveRobber(Guid actorId, string hexId, Guid? victimId);

    IReadOnlyList<Guid> GetStealCandidates(string hexId);

    GameStateDto BuyDevelopmentCard(Guid actorId);

    GameStateDto PlayKnightCard(Guid actorId, Guid cardId);

    /// <summary>Returns how many cards were collected so the hub can announce it.</summary>
    (int Collected, GameStateDto State) PlayMonopoly(Guid actorId, Guid cardId, string resource);

    GameStateDto PlayYearOfPlenty(Guid actorId, Guid cardId, string first, string second);

    GameStateDto PlayRoadBuilding(Guid actorId, Guid cardId);

    GameStateDto PlaceInitialSettlement(Guid actorId, string nodeId);

    GameStateDto PlaceInitialRoad(Guid actorId, string edgeId);

    /// <summary>Starts a fresh game on a new board with the given number of seats (3 or 4).</summary>
    GameStateDto StartGame(int playerCount, bool allowSevens = true);

    /// <summary>Starts a fresh game for the given named seats (lobby flow).</summary>
    GameStateDto StartGame(IReadOnlyList<(Guid Id, string Name, PlayerColor Color)> seats, bool allowSevens = true);

    /// <summary>Forces progress when the turn clock expires. Null if nothing needed doing.</summary>
    (TimeoutResolution Resolution, DiceRolledDto? Roll, GameStateDto State)? ResolveTimeout();

    /// <summary>Server-side turn clock; the hub decides when to arm/reset it.</summary>
    DateTimeOffset? TurnDeadline { get; }

    void SetTurnDeadline(DateTimeOffset? deadline);

    /// <summary>Opaque marker that changes whenever the actor-to-wait-for changes.</summary>
    (GamePhase Phase, Guid Actor, bool Rolled, int Turn) TurnKey { get; }
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
    private bool _allowSevens = true;

    public GameStateService()
    {
        _snapshot = CreateSnapshot();
        _game = CreateGame(_snapshot, _playerCount, _allowSevens);
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
            _game = CreateGame(snapshot, _playerCount, _allowSevens);
            return Project(snapshot.Id, snapshot.Board);
        }
    }

    public GameStateDto StartGame(int playerCount, bool allowSevens = true)
    {
        if (playerCount is < MinPlayers or > MaxPlayers)
        {
            throw new GameRuleException($"Choose between {MinPlayers} and {MaxPlayers} players.");
        }

        var seats = DefaultSeats
            .Take(playerCount)
            .Select(seat => (Guid.NewGuid(), seat.Name, seat.Color))
            .ToList();

        return StartGame(seats, allowSevens);
    }

    public GameStateDto StartGame(IReadOnlyList<(Guid Id, string Name, PlayerColor Color)> seats, bool allowSevens = true)
    {
        if (seats.Count is < MinPlayers or > MaxPlayers)
        {
            throw new GameRuleException($"A game needs between {MinPlayers} and {MaxPlayers} players.");
        }

        lock (_gate)
        {
            _playerCount = seats.Count;
            _allowSevens = allowSevens;
            var snapshot = CreateSnapshot();
            Volatile.Write(ref _snapshot, snapshot);
            var players = seats.Select(seat => new Player(seat.Id, seat.Name, seat.Color)).ToArray();
            _game = new Game(snapshot.Id, snapshot.Board, players, allowSevens: allowSevens);
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

    private DateTimeOffset? _turnDeadline;

    public DateTimeOffset? TurnDeadline
    {
        get { lock (_gate) { return _turnDeadline; } }
    }

    public void SetTurnDeadline(DateTimeOffset? deadline)
    {
        lock (_gate)
        {
            _turnDeadline = deadline;
        }
    }

    public (GamePhase Phase, Guid Actor, bool Rolled, int Turn) TurnKey
    {
        get
        {
            lock (_gate)
            {
                // During discards/robber the clock belongs to whoever must act, not the roller.
                var actor = _game.Phase == GamePhase.MovingRobber ? _game.RobberMover ?? _game.CurrentTurnPlayerId : _game.CurrentTurnPlayerId;
                return (_game.Phase, actor, _game.HasRolledDice, _game.TurnNumber);
            }
        }
    }

    public (TimeoutResolution Resolution, DiceRolledDto? Roll, GameStateDto State)? ResolveTimeout()
    {
        lock (_gate)
        {
            if (_game.Phase == GamePhase.GameOver)
            {
                return null;
            }

            var resolution = _game.ResolveTimeout();
            _game.CheckForWinner();
            return (resolution, resolution.Roll is { } roll ? ProjectRoll(roll) : null, ProjectGame(_game));
        }
    }

    public (DiceRolledDto Roll, GameStateDto State) RollDice(Guid actorId)
    {
        lock (_gate)
        {
            var outcome = _game.RollDice(actorId);
            return (ProjectRoll(outcome), ProjectGame(_game));
        }
    }

    public GameStateDto EndTurn(Guid actorId)
    {
        lock (_gate)
        {
            _game.EndTurn(actorId);
            return ProjectGame(_game);
        }
    }

    public GameStateDto BuildSettlement(Guid actorId, string nodeId)
    {
        lock (_gate)
        {
            var node = _game.Board.FindNode(nodeId)
                ?? throw new GameRuleException("That intersection is not on the board.");

            _game.BuildSettlement(actorId, node.Id);
            _game.CheckForWinner();
            return ProjectGame(_game);
        }
    }

    public GameStateDto BuildRoad(Guid actorId, string edgeId)
    {
        lock (_gate)
        {
            var edge = _game.Board.FindEdge(edgeId)
                ?? throw new GameRuleException("That path is not on the board.");

            if (_game.Phase == GamePhase.PlacingFreeRoads)
            {
                _game.PlaceFreeRoad(actorId, edge.Id);
            }
            else
            {
                _game.BuildRoad(actorId, edge.Id);
            }

            _game.CheckForWinner();
            return ProjectGame(_game);
        }
    }

    public GameStateDto BuildCity(Guid actorId, string nodeId)
    {
        lock (_gate)
        {
            var node = _game.Board.FindNode(nodeId)
                ?? throw new GameRuleException("That intersection is not on the board.");

            _game.BuildCity(actorId, node.Id);
            _game.CheckForWinner();
            return ProjectGame(_game);
        }
    }

    public GameStateDto TradeWithBank(Guid actorId, string resourceToGive, string resourceToReceive)
    {
        var give = ParseResource(resourceToGive);
        var receive = ParseResource(resourceToReceive);

        lock (_gate)
        {
            _game.TradeWithBank(actorId, give, receive);
            return ProjectGame(_game);
        }
    }

    private static ResourceType ParseResource(string name) =>
        Enum.TryParse<ResourceType>(name, ignoreCase: true, out var resource)
            ? resource
            : throw new GameRuleException($"'{name}' is not a resource.");

    private static Dictionary<ResourceType, int> ParseBundle(IReadOnlyDictionary<string, int> bundle) =>
        bundle
            .Where(pair => pair.Value != 0)
            .ToDictionary(pair => ParseResource(pair.Key), pair => pair.Value);

    public (TradeOfferDto Offer, GameStateDto State) ProposeTrade(
        Guid actorId,
        Guid? targetPlayerId,
        IReadOnlyDictionary<string, int> offered,
        IReadOnlyDictionary<string, int> requested)
    {
        var give = ParseBundle(offered);
        var get = ParseBundle(requested);

        lock (_gate)
        {
            var offer = _game.ProposeTrade(actorId, targetPlayerId, give, get);
            return (ProjectOffer(offer), ProjectGame(_game));
        }
    }

    public (TradeOfferDto Offer, GameStateDto State) AcceptTrade(Guid actorId, Guid offerId)
    {
        lock (_gate)
        {
            var offer = _game.AcceptTrade(actorId, offerId);
            return (ProjectOffer(offer), ProjectGame(_game));
        }
    }

    public (TradeOfferDto Offer, bool Removed, GameStateDto State) RejectTrade(Guid actorId, Guid offerId)
    {
        lock (_gate)
        {
            var offer = _game.ActiveTradeOffer;
            var removed = _game.RejectTrade(actorId, offerId);
            return (ProjectOffer(offer!), removed, ProjectGame(_game));
        }
    }

    public GameStateDto CancelTrade(Guid actorId, Guid offerId)
    {
        lock (_gate)
        {
            _game.CancelTrade(actorId, offerId);
            return ProjectGame(_game);
        }
    }

    private static TradeOfferDto ProjectOffer(TradeOffer offer) =>
        new(
            offer.OfferId,
            offer.SenderPlayerId,
            offer.TargetPlayerId,
            offer.ResourcesOffered.ToDictionary(pair => pair.Key.ToString(), pair => pair.Value),
            offer.ResourcesRequested.ToDictionary(pair => pair.Key.ToString(), pair => pair.Value),
            offer.DeclinedBy.ToList());

    public GameStateDto DiscardCards(Guid actorId, IReadOnlyDictionary<string, int> cards)
    {
        var parsed = cards
            .Where(pair => pair.Value != 0)
            .ToDictionary(pair => ParseResource(pair.Key), pair => pair.Value);

        lock (_gate)
        {
            _game.DiscardCards(actorId, parsed);
            return ProjectGame(_game);
        }
    }

    public (RobberMovedDto Event, GameStateDto State) MoveRobber(Guid actorId, string hexId, Guid? victimId)
    {
        var target = ParseHexId(hexId);

        lock (_gate)
        {
            var mover = _game.RobberMover
                ?? throw new GameRuleException("The robber cannot be moved right now.");

            if (mover != actorId)
            {
                throw new GameRuleException("Only the player who triggered the robber can move it.");
            }

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

    public GameStateDto BuyDevelopmentCard(Guid actorId)
    {
        lock (_gate)
        {
            _game.BuyDevelopmentCard(actorId);
            _game.CheckForWinner();
            return ProjectGame(_game);
        }
    }

    public GameStateDto PlayKnightCard(Guid actorId, Guid cardId)
    {
        lock (_gate)
        {
            _game.PlayKnightCard(actorId, cardId);
            _game.CheckForWinner();
            return ProjectGame(_game);
        }
    }

    public (int Collected, GameStateDto State) PlayMonopoly(Guid actorId, Guid cardId, string resource)
    {
        var parsed = ParseResource(resource);
        lock (_gate)
        {
            var collected = _game.PlayMonopoly(actorId, cardId, parsed);
            return (collected, ProjectGame(_game));
        }
    }

    public GameStateDto PlayYearOfPlenty(Guid actorId, Guid cardId, string first, string second)
    {
        var a = ParseResource(first);
        var b = ParseResource(second);
        lock (_gate)
        {
            _game.PlayYearOfPlenty(actorId, cardId, a, b);
            return ProjectGame(_game);
        }
    }

    public GameStateDto PlayRoadBuilding(Guid actorId, Guid cardId)
    {
        lock (_gate)
        {
            _game.PlayRoadBuilding(actorId, cardId);
            return ProjectGame(_game);
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

    public GameStateDto PlaceInitialSettlement(Guid actorId, string nodeId)
    {
        lock (_gate)
        {
            var node = _game.Board.FindNode(nodeId)
                ?? throw new GameRuleException("That intersection is not on the board.");

            _game.PlaceInitialSettlement(actorId, node.Id);
            return ProjectGame(_game);
        }
    }

    public GameStateDto PlaceInitialRoad(Guid actorId, string edgeId)
    {
        lock (_gate)
        {
            var edge = _game.Board.FindEdge(edgeId)
                ?? throw new GameRuleException("That path is not on the board.");

            _game.PlaceInitialRoad(actorId, edge.Id);
            return ProjectGame(_game);
        }
    }

    private static BoardSnapshot CreateSnapshot() =>
        new(Guid.NewGuid(), BoardFactory.CreateStandardBoard());

    private static Game CreateGame(BoardSnapshot snapshot, int playerCount, bool allowSevens)
    {
        var players = DefaultSeats
            .Take(playerCount)
            .Select(seat => new Player(Guid.NewGuid(), seat.Name, seat.Color))
            .ToArray();

        return new Game(snapshot.Id, snapshot.Board, players, allowSevens: allowSevens);
    }

    private GameStateDto ProjectGame(Game game)
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
                game.CitiesRemaining(player.Id),
                player.DevelopmentCards
                    .Select(card => new DevelopmentCardDto(
                        card.Id,
                        card.Type.ToString(),
                        card.IsPlayed,
                        CanPlayNow: player.Id == game.CurrentTurnPlayerId
                                    && game.Phase == GamePhase.MainGame
                                    && !game.DevelopmentCardPlayedThisTurn
                                    && card.CanPlayOnTurn(game.TurnNumber)))
                    .ToList(),
                player.KnightsPlayed,
                game.RoadLengths.GetValueOrDefault(player.Id),
                game.BankRates(player.Id).ToDictionary(pair => pair.Key.ToString(), pair => pair.Value),
                ResourceCardCount: player.Resources.Values.Sum(),
                UnplayedDevCardCount: player.DevelopmentCards.Count(card => !card.IsPlayed),
                VictoryPointBreakdown: new VictoryPointBreakdownDto(
                    Settlements: game.SettlementsBuilt(player.Id),
                    Cities: game.CitiesBuilt(player.Id) * 2,
                    LongestRoad: game.LongestRoadHolderId == player.Id ? Achievements.BonusVictoryPoints : 0,
                    LargestArmy: game.LargestArmyHolderId == player.Id ? Achievements.BonusVictoryPoints : 0,
                    VictoryPointCards: player.DevelopmentCards.Count(card => card.Type == DevelopmentCardType.VictoryPoint))))
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
            game.PendingDiscards.ToDictionary(pair => pair.Key, pair => pair.Value),
            game.DevelopmentCardsRemaining,
            game.TurnNumber,
            game.FreeRoadsRemaining,
            game.WinnerId,
            game.LargestArmyHolderId,
            game.LongestRoadHolderId,
            game.LongestRoadLength,
            game.ActiveTradeOffer is { } offer ? ProjectOffer(offer) : null,
            game.AllowSevens,
            game.HasRolledDice,
            _turnDeadline,
            new Dictionary<int, int>(game.DiceRollFrequencies));
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
                node.Building.ToString(),
                node.Harbor.ToString()))
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
