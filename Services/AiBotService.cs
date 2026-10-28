using System.Collections.Concurrent;
using CatanServer.Contracts;
using CatanServer.Domain;
using CatanServer.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace CatanServer.Services;

/// <summary>
/// Computer players. <see cref="Sync"/> is called after every broadcast; if any bot in the
/// room has something to do (roll, discard, move the robber, build, answer a trade, end
/// the turn) a background loop performs those moves one at a time with human-visible
/// pauses. Moves go through the same <see cref="IGameStateService"/> entry points and
/// emit the same SignalR events as human moves, so clients cannot tell the difference.
/// </summary>
public sealed class AiBotService
{
    public static readonly TimeSpan ThinkDelay = TimeSpan.FromSeconds(1.5);
    public static readonly TimeSpan BuildDelay = TimeSpan.FromSeconds(0.9);

    /// <summary>How long a bot leaves its own trade offer open for humans before withdrawing it.</summary>
    public static readonly TimeSpan OfferWindow = TimeSpan.FromSeconds(10);

    private sealed class Entry
    {
        public int Running;
        public int Dirty;
    }

    private readonly ConcurrentDictionary<string, Entry> _entries = new(StringComparer.OrdinalIgnoreCase);
    private readonly RoomManager _rooms;
    private readonly TurnTimerService _timers;
    private readonly IHubContext<GameHub, IGameClient> _hub;
    private readonly ILogger<AiBotService> _logger;

    public AiBotService(RoomManager rooms, TurnTimerService timers, IHubContext<GameHub, IGameClient> hub, ILogger<AiBotService> logger)
    {
        _rooms = rooms;
        _timers = timers;
        _hub = hub;
        _logger = logger;

        // Timeouts can hand the turn to a bot without going through the hub.
        _timers.Resolved += Sync;
    }

    /// <summary>Wake the bot loop for this room. Cheap and idempotent; safe to call after every move.</summary>
    public void Sync(Room room)
    {
        if (room.Status != RoomStatus.InGame || !room.HasBots)
        {
            return;
        }

        var entry = _entries.GetOrAdd(room.Id, _ => new Entry());
        Interlocked.Exchange(ref entry.Dirty, 1);
        if (Interlocked.CompareExchange(ref entry.Running, 1, 0) == 0)
        {
            _ = RunAsync(room, entry);
        }
    }

    private async Task RunAsync(Room room, Entry entry)
    {
        try
        {
            do
            {
                Interlocked.Exchange(ref entry.Dirty, 0);
                await StepUntilIdleAsync(room, entry);
            }
            while (Volatile.Read(ref entry.Dirty) == 1);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{RoomId}] Bot loop crashed", room.Id);
        }
        finally
        {
            Volatile.Write(ref entry.Running, 0);
            if (Volatile.Read(ref entry.Dirty) == 1)
            {
                Sync(room);
            }
        }
    }

    private async Task StepUntilIdleAsync(Room room, Entry entry)
    {
        for (var guard = 0; guard < 64; guard++)
        {
            // Room dropped (every human left) or game finished: stop.
            if (!_rooms.TryGet(room.Id, out _) || room.Status != RoomStatus.InGame)
            {
                return;
            }

            var state = room.Game.GetGameState();
            var plan = BotBrain.Plan(room, state);
            if (plan is null)
            {
                return;
            }

            // Wait in slices so a human move (e.g. accepting our offer) cuts a long wait short.
            Interlocked.Exchange(ref entry.Dirty, 0);
            var waited = TimeSpan.Zero;
            while (waited < plan.Delay)
            {
                var slice = TimeSpan.FromMilliseconds(Math.Min(250, (plan.Delay - waited).TotalMilliseconds));
                await Task.Delay(slice);
                waited += slice;
                if (plan.Delay > AiBotService.ThinkDelay && Volatile.Read(ref entry.Dirty) == 1)
                {
                    break;
                }
            }

            if (waited < plan.Delay)
            {
                continue;
            }

            // Re-validate: a human may have acted (e.g. cancelled a trade) during the pause.
            if (room.Status != RoomStatus.InGame || room.Game.TurnKey != plan.Key)
            {
                continue;
            }

            BotMoveResult result;
            try
            {
                result = plan.Execute(room.Game);
            }
            catch (GameRuleException ex)
            {
                // The heuristic picked something the rules refused; log and let the next pass pick differently.
                _logger.LogInformation("[{RoomId}] Bot {Bot} move '{Move}' rejected: {Reason}", room.Id, plan.BotName, plan.Description, ex.Message);
                if (plan.IsFallbackSafe)
                {
                    continue;
                }

                // Guarantee progress: let the timeout machinery take the minimum legal action.
                var forced = room.Game.ResolveTimeout();
                if (forced is null)
                {
                    return;
                }

                result = new BotMoveResult(forced.Value.State, forced.Value.Roll, null, null);
            }

            _logger.LogInformation("[{RoomId}] Bot {Bot}: {Move}", room.Id, plan.BotName, plan.Description);
            await PublishAsync(room, plan, result);
        }
    }

    private async Task PublishAsync(Room room, BotPlan plan, BotMoveResult result)
    {
        var group = _hub.Clients.Group(room.Id);

        if (plan.Announce is { } text && !result.Silent)
        {
            await group.SystemMessage(new SystemMessageDto($"{plan.BotName} {text}.", "info", DateTimeOffset.UtcNow));
        }

        if (result.Roll is not null)
        {
            await group.DiceRolled(result.Roll);
        }

        if (result.Robber is not null)
        {
            await group.RobberMoved(result.Robber);
            if (result.Robber is { VictimId: { } victimId, StolenResource: { } stolen })
            {
                var victim = room.FindById(victimId)?.Name ?? "Someone";
                await group.SystemMessage(new SystemMessageDto(
                    $"Player {plan.BotName} stole 1 {stolen} from Player {victim}.", "bad", DateTimeOffset.UtcNow));
            }
        }

        if (result.Offered is not null)
        {
            await group.TradeOffered(result.Offered);
        }

        if (result.Trade is not null)
        {
            await group.TradeResolved(result.Trade);
        }

        var state = result.State;
        var sends = room.Members
            .Where(m => m.ConnectionId is not null)
            .Select(m => _hub.Clients.Client(m.ConnectionId!).GameState(new ClientGameStateDto(state, m.Id)));
        await Task.WhenAll(sends);

        if (state.Phase == nameof(GamePhase.GameOver) && state.WinnerId is { } winnerId)
        {
            await group.GameOver(state.Players.First(p => p.Id == winnerId).Redacted(revealVictoryPointCards: true));
        }

        _timers.Sync(room);
    }
}

/// <summary>Outcome of a bot move: the new state plus any side-events the hub would normally broadcast.</summary>
public sealed record BotMoveResult(GameStateDto State, DiceRolledDto? Roll, RobberMovedDto? Robber, TradeResolvedDto? Trade)
{
    /// <summary>A new player-to-player offer the bot just put on the table.</summary>
    public TradeOfferDto? Offered { get; init; }

    /// <summary>Nothing actually changed (e.g. a stale withdraw); skip the announcement.</summary>
    public bool Silent { get; init; }
}

/// <summary>A decided move waiting for its think-delay.</summary>
public sealed record BotPlan(
    string BotName,
    string Description,
    string? Announce,
    TimeSpan Delay,
    (GamePhase Phase, Guid Actor, bool Rolled, int Turn) Key,
    bool IsFallbackSafe,
    Func<IGameStateService, BotMoveResult> Execute);

/// <summary>Rule-based decision making. Pure: reads the state and board, returns a plan.</summary>
internal static class BotBrain
{
    private static readonly Random Rng = new();

    public static BotPlan? Plan(Room room, GameStateDto state)
    {
        var key = room.Game.TurnKey;
        var board = room.Game.Board;
        var phase = Enum.Parse<GamePhase>(state.Phase);

        if (phase == GamePhase.GameOver)
        {
            return null;
        }

        // 1. Discards are owed by anyone, regardless of whose turn it is.
        if (phase == GamePhase.WaitingForDiscards)
        {
            foreach (var (playerId, owed) in state.PendingDiscards)
            {
                if (room.IsBot(playerId))
                {
                    return Discard(room, state, playerId, owed, key);
                }
            }

            return null;
        }

        // 2. Someone is answering a trade (human- or bot-proposed) addressed to a bot.
        if (state.ActiveTradeOffer is { } offer)
        {
            var responder = room.Members
                .Where(m => m.IsBot && m.Id != offer.SenderPlayerId && !offer.DeclinedBy.Contains(m.Id))
                .FirstOrDefault(m => offer.TargetPlayerId is null || offer.TargetPlayerId == m.Id);
            if (responder is not null)
            {
                return AnswerTrade(state, board, responder, offer, key);
            }

            // A bot's own offer is still on the table waiting for humans: give them a moment, then withdraw.
            if (room.IsBot(offer.SenderPlayerId))
            {
                return AwaitOwnOffer(room.FindById(offer.SenderPlayerId)!, offer, key);
            }
        }

        // 3. Robber movement belongs to whoever triggered it.
        if (phase == GamePhase.MovingRobber)
        {
            var mover = state.RobberMoverId ?? state.CurrentTurnPlayerId;
            return room.IsBot(mover) ? MoveRobber(room, state, board, mover, key) : null;
        }

        var actor = room.FindById(state.CurrentTurnPlayerId);
        if (actor is null || !actor.IsBot)
        {
            return null;
        }

        return phase switch
        {
            GamePhase.SetupRound1 or GamePhase.SetupRound2 => Setup(state, board, actor, key),
            GamePhase.PlacingFreeRoads => FreeRoad(board, actor, key),
            GamePhase.MainGame when !state.HasRolledDice => Roll(actor, key),
            GamePhase.MainGame => Build(state, board, actor, key)
                                  ?? ProposeTrade(room, state, board, actor, key)
                                  ?? EndTurn(state, actor, key),
            _ => null,
        };
    }

    // ------------------------------------------------------------------ Turn flow

    private static BotPlan Roll(RoomMember bot, (GamePhase, Guid, bool, int) key) =>
        new(bot.Name, "roll dice", null, AiBotService.ThinkDelay, key, IsFallbackSafe: false, game =>
        {
            var (roll, state) = game.RollDice(bot.Id);
            return new BotMoveResult(state, roll, null, null);
        });

    private static BotPlan EndTurn(GameStateDto state, RoomMember bot, (GamePhase, Guid, bool, int) key)
    {
        // Withdraw our own dangling offer first (we never make one, but be safe).
        var ownOffer = state.ActiveTradeOffer?.SenderPlayerId == bot.Id ? state.ActiveTradeOffer : null;
        return new BotPlan(bot.Name, "end turn", "ends their turn", AiBotService.ThinkDelay, key, IsFallbackSafe: false, game =>
        {
            if (ownOffer is not null)
            {
                game.CancelTrade(bot.Id, ownOffer.OfferId);
            }

            return new BotMoveResult(game.EndTurn(bot.Id), null, null, null);
        });
    }

    // ------------------------------------------------------------------ Setup

    private static BotPlan? Setup(GameStateDto state, BoardGraph board, RoomMember bot, (GamePhase, Guid, bool, int) key)
    {
        if (state.SetupStep == nameof(SetupStep.PlaceSettlement))
        {
            var node = board.Nodes
                .Where(n => !n.IsOccupied && n.Neighbors.All(id => !board.GetNode(id).IsOccupied))
                .OrderByDescending(n => Pips(board, n) + Diversity(board, n) + Rng.NextDouble())
                .FirstOrDefault();
            if (node is null)
            {
                return null;
            }

            var nodeId = node.Id.ToString();
            return new BotPlan(bot.Name, $"place initial settlement {nodeId}", "founds a settlement", AiBotService.ThinkDelay, key, IsFallbackSafe: false,
                game => new BotMoveResult(game.PlaceInitialSettlement(bot.Id, nodeId), null, null, null));
        }

        if (state.PendingSetupSettlementNodeId is null)
        {
            return null;
        }

        var anchor = board.FindNode(state.PendingSetupSettlementNodeId);
        var edge = anchor?.Edges
            .Select(board.GetEdge)
            .Where(e => !e.HasRoad)
            .OrderByDescending(e => Pips(board, board.GetNode(e.Other(anchor.Id))) + Rng.NextDouble())
            .FirstOrDefault();
        if (edge is null)
        {
            return null;
        }

        var edgeId = edge.Id.ToString();
        return new BotPlan(bot.Name, $"place initial road {edgeId}", null, AiBotService.BuildDelay, key, IsFallbackSafe: false,
            game => new BotMoveResult(game.PlaceInitialRoad(bot.Id, edgeId), null, null, null));
    }

    private static BotPlan? FreeRoad(BoardGraph board, RoomMember bot, (GamePhase, Guid, bool, int) key)
    {
        var edge = BestRoadEdge(board, bot.Id);
        if (edge is null)
        {
            return null;
        }

        var edgeId = edge.Id.ToString();
        return new BotPlan(bot.Name, $"place free road {edgeId}", "builds a road", AiBotService.BuildDelay, key, IsFallbackSafe: false,
            game => new BotMoveResult(game.BuildRoad(bot.Id, edgeId), null, null, null));
    }

    // ------------------------------------------------------------------ Building (greedy: city > settlement > road)

    private static BotPlan? Build(GameStateDto state, BoardGraph board, RoomMember bot, (GamePhase, Guid, bool, int) key)
    {
        var me = state.Players.First(p => p.Id == bot.Id);
        var hand = me.Resources ?? new Dictionary<string, int>();

        if (me.CitiesRemaining > 0 && CanAfford(hand, BuildingCosts.City))
        {
            var node = board.Nodes
                .Where(n => n.OwnerId == bot.Id && n.Building == BuildingType.Settlement)
                .OrderByDescending(n => Pips(board, n) + Rng.NextDouble())
                .FirstOrDefault();
            if (node is not null)
            {
                var nodeId = node.Id.ToString();
                return new BotPlan(bot.Name, $"build city {nodeId}", "raises a city", AiBotService.BuildDelay, key, IsFallbackSafe: true,
                    game => new BotMoveResult(game.BuildCity(bot.Id, nodeId), null, null, null));
            }
        }

        if (me.SettlementsRemaining > 0 && CanAfford(hand, BuildingCosts.Settlement))
        {
            var node = board.Nodes
                .Where(n => IsVacantRespectingDistance(board, n) && n.Edges.Any(e => board.GetEdge(e).OwnerId == bot.Id))
                .OrderByDescending(n => Pips(board, n) + Rng.NextDouble())
                .FirstOrDefault();
            if (node is not null)
            {
                var nodeId = node.Id.ToString();
                return new BotPlan(bot.Name, $"build settlement {nodeId}", "founds a settlement", AiBotService.BuildDelay, key, IsFallbackSafe: true,
                    game => new BotMoveResult(game.BuildSettlement(bot.Id, nodeId), null, null, null));
            }
        }

        if (me.RoadsRemaining > 0 && CanAfford(hand, BuildingCosts.Road))
        {
            var edge = BestRoadEdge(board, bot.Id);
            if (edge is not null)
            {
                var edgeId = edge.Id.ToString();
                return new BotPlan(bot.Name, $"build road {edgeId}", "builds a road", AiBotService.BuildDelay, key, IsFallbackSafe: true,
                    game => new BotMoveResult(game.BuildRoad(bot.Id, edgeId), null, null, null));
            }
        }

        return null;
    }

    // ------------------------------------------------------------------ Robber

    private static BotPlan Discard(Room room, GameStateDto state, Guid botId, int owed, (GamePhase, Guid, bool, int) key)
    {
        var bot = room.FindById(botId)!;
        var hand = state.Players.First(p => p.Id == botId).Resources ?? new Dictionary<string, int>();
        var discard = hand
            .SelectMany(pair => Enumerable.Repeat(pair.Key, pair.Value))
            .OrderBy(_ => Rng.Next())
            .Take(owed)
            .GroupBy(r => r)
            .ToDictionary(g => g.Key, g => g.Count());

        return new BotPlan(bot.Name, $"discard {owed}", $"discards {owed} card{(owed == 1 ? string.Empty : "s")}", AiBotService.ThinkDelay, key, IsFallbackSafe: false,
            game => new BotMoveResult(game.DiscardCards(botId, discard), null, null, null));
    }

    private static BotPlan MoveRobber(Room room, GameStateDto state, BoardGraph board, Guid moverId, (GamePhase, Guid, bool, int) key)
    {
        var bot = room.FindById(moverId)!;

        // Target the human with the most victory points (fall back to any opponent).
        var opponents = state.Players.Where(p => p.Id != moverId).ToList();
        var target = opponents
            .Where(p => !room.IsBot(p.Id))
            .OrderByDescending(p => p.VictoryPoints)
            .ThenByDescending(p => p.ResourceCardCount)
            .FirstOrDefault()
            ?? opponents.OrderByDescending(p => p.VictoryPoints).FirstOrDefault();

        var candidates = board.Hexes.Where(h => !h.HasRobber && h.Type != HexType.Desert).ToList();
        var hex = target is null
            ? null
            : candidates
                .Where(h => h.Nodes.Any(n => board.GetNode(n).OwnerId == target.Id))
                .OrderByDescending(h => HexPips(h)
                                        + 2 * h.Nodes.Count(n => board.GetNode(n).OwnerId == target.Id)
                                        - 3 * h.Nodes.Count(n => board.GetNode(n).OwnerId == moverId)
                                        + Rng.NextDouble())
                .FirstOrDefault();
        hex ??= candidates[Rng.Next(candidates.Count)];

        var hexId = $"{hex.Coordinate.Q},{hex.Coordinate.R}";
        var preferred = target?.Id;

        return new BotPlan(bot.Name, $"move robber {hexId}", target is null ? "moves the robber" : $"sends the robber after {target.Name}", AiBotService.ThinkDelay, key, IsFallbackSafe: false, game =>
        {
            var victims = game.GetStealCandidates(hexId);
            Guid? victim = preferred is { } p && victims.Contains(p) ? p : victims.Count > 0 ? victims[Rng.Next(victims.Count)] : null;
            var (evt, newState) = game.MoveRobber(moverId, hexId, victim);
            return new BotMoveResult(newState, null, evt, null);
        });
    }

    // ------------------------------------------------------------------ Trades

    /// <summary>Remembers which turn each bot last proposed a trade on, so it only tries once per turn.</summary>
    private static readonly ConcurrentDictionary<(string Room, Guid Bot), int> LastProposalTurn = new();

    /// <summary>
    /// Accept when the cards received are worth more to us than the cards given: resources we
    /// are missing for our next build count high, surplus copies count low, and we never give
    /// away something the next build needs.
    /// </summary>
    private static BotPlan AnswerTrade(GameStateDto state, BoardGraph board, RoomMember bot, TradeOfferDto offer, (GamePhase, Guid, bool, int) key)
    {
        var hand = state.Players.First(p => p.Id == bot.Id).Resources ?? new Dictionary<string, int>();
        var (_, missing, cost) = NextGoal(state, board, bot.Id);

        var accept = CanAfford(hand, offer.ResourcesRequested)
                     && offer.ResourcesRequested.All(pair => hand.GetValueOrDefault(pair.Key) - pair.Value >= cost.GetValueOrDefault(pair.Key))
                     && Worth(offer.ResourcesOffered, hand, missing, receiving: true) > Worth(offer.ResourcesRequested, hand, missing, receiving: false);

        return accept
            ? new BotPlan(bot.Name, "accept trade", "accepts the trade", AiBotService.ThinkDelay, key, IsFallbackSafe: true, game =>
            {
                var (_, newState) = game.AcceptTrade(bot.Id, offer.OfferId);
                return new BotMoveResult(newState, null, null, new TradeResolvedDto(offer.OfferId, bot.Id, "Accepted"));
            })
            : new BotPlan(bot.Name, "reject trade", "declines the trade", AiBotService.ThinkDelay, key, IsFallbackSafe: true, game =>
            {
                var (_, removed, newState) = game.RejectTrade(bot.Id, offer.OfferId);
                return new BotMoveResult(newState, null, null, new TradeResolvedDto(offer.OfferId, bot.Id, removed ? "Rejected" : "Declined"));
            });
    }

    /// <summary>
    /// If exactly one card short of the next build, offer a surplus card to anyone for the
    /// missing one. Once per turn; the offer is withdrawn by <see cref="AwaitOwnOffer"/> if ignored.
    /// </summary>
    private static BotPlan? ProposeTrade(Room room, GameStateDto state, BoardGraph board, RoomMember bot, (GamePhase, Guid, bool, int) key)
    {
        if (state.ActiveTradeOffer is not null || LastProposalTurn.GetValueOrDefault((room.Id, bot.Id), -1) == state.TurnNumber)
        {
            return null;
        }

        var hand = state.Players.First(p => p.Id == bot.Id).Resources ?? new Dictionary<string, int>();
        var (goal, missing, cost) = NextGoal(state, board, bot.Id);
        if (goal is null || missing.Values.Sum() != 1)
        {
            return null;
        }

        var want = missing.First().Key;
        var spare = hand
            .Where(pair => pair.Value - cost.GetValueOrDefault(pair.Key) > 0)
            .OrderByDescending(pair => pair.Value - cost.GetValueOrDefault(pair.Key))
            .Select(pair => pair.Key)
            .FirstOrDefault();
        if (spare is null)
        {
            return null;
        }

        LastProposalTurn[(room.Id, bot.Id)] = state.TurnNumber;
        var give = new Dictionary<string, int> { [spare] = 1 };
        var get = new Dictionary<string, int> { [want] = 1 };

        return new BotPlan(bot.Name, $"propose {spare} for {want}", $"offers 1 {spare} for 1 {want} to anyone (for a {goal})", AiBotService.ThinkDelay, key, IsFallbackSafe: true,
            game =>
            {
                var (offer, newState) = game.ProposeTrade(bot.Id, null, give, get);
                return new BotMoveResult(newState, null, null, null) { Offered = offer };
            });
    }

    /// <summary>Nobody took the offer within the window: withdraw it and carry on with the turn.</summary>
    private static BotPlan AwaitOwnOffer(RoomMember bot, TradeOfferDto offer, (GamePhase, Guid, bool, int) key) =>
        new(bot.Name, "withdraw trade", "withdraws the offer", AiBotService.OfferWindow, key, IsFallbackSafe: true, game =>
        {
            var current = game.GetGameState();
            if (current.ActiveTradeOffer?.OfferId != offer.OfferId)
            {
                // Already accepted or declined by everyone while we waited.
                return new BotMoveResult(current, null, null, null) { Silent = true };
            }

            var newState = game.CancelTrade(bot.Id, offer.OfferId);
            return new BotMoveResult(newState, null, null, new TradeResolvedDto(offer.OfferId, null, "Cancelled"));
        });

    /// <summary>
    /// The build the bot is working toward (city > settlement > road, matching <see cref="Build"/>),
    /// the cards still missing for it, and its full cost.
    /// </summary>
    private static (string? Goal, Dictionary<string, int> Missing, IReadOnlyDictionary<string, int> Cost) NextGoal(GameStateDto state, BoardGraph board, Guid botId)
    {
        var me = state.Players.First(p => p.Id == botId);
        var hand = me.Resources ?? new Dictionary<string, int>();

        IReadOnlyDictionary<ResourceType, int>? cost = null;
        string? goal = null;

        if (me.CitiesRemaining > 0 && board.Nodes.Any(n => n.OwnerId == botId && n.Building == BuildingType.Settlement))
        {
            (goal, cost) = ("city", BuildingCosts.City);
        }
        else if (me.SettlementsRemaining > 0 && board.Nodes.Any(n => IsVacantRespectingDistance(board, n) && n.Edges.Any(e => board.GetEdge(e).OwnerId == botId)))
        {
            (goal, cost) = ("settlement", BuildingCosts.Settlement);
        }
        else if (me.RoadsRemaining > 0)
        {
            (goal, cost) = ("road", BuildingCosts.Road);
        }

        var costByName = (cost ?? new Dictionary<ResourceType, int>()).ToDictionary(p => p.Key.ToString(), p => p.Value);
        var missing = costByName
            .Select(p => (p.Key, Short: p.Value - hand.GetValueOrDefault(p.Key)))
            .Where(p => p.Short > 0)
            .ToDictionary(p => p.Key, p => p.Short);

        return (goal, missing, costByName);
    }

    /// <summary>Subjective value of a bundle: 3 per card we are missing, 1 otherwise, 0.4 per surplus copy beyond two.</summary>
    private static double Worth(IReadOnlyDictionary<string, int> bundle, IReadOnlyDictionary<string, int> hand, IReadOnlyDictionary<string, int> missing, bool receiving)
    {
        double total = 0;
        foreach (var (resource, count) in bundle)
        {
            var have = hand.GetValueOrDefault(resource);
            for (var i = 0; i < count; i++)
            {
                var owned = receiving ? have + i : have - i;
                total += missing.ContainsKey(resource) && (receiving ? i < missing[resource] : true) ? 3
                       : owned > 2 ? 0.4
                       : 1;
            }
        }

        return total;
    }

    // ------------------------------------------------------------------ Heuristics

    private static Edge? BestRoadEdge(BoardGraph board, Guid playerId) =>
        board.Edges
            .Where(e => !e.HasRoad && (IsConnectedForRoad(board, playerId, e, e.First) || IsConnectedForRoad(board, playerId, e, e.Second)))
            .OrderByDescending(e =>
            {
                // Prefer roads that open up a new settlement spot, then richer destinations.
                var a = board.GetNode(e.First);
                var b = board.GetNode(e.Second);
                var opens = (IsVacantRespectingDistance(board, a) ? 1 : 0) + (IsVacantRespectingDistance(board, b) ? 1 : 0);
                return opens * 10 + Math.Max(Pips(board, a), Pips(board, b)) + Rng.NextDouble();
            })
            .FirstOrDefault();

    private static bool IsConnectedForRoad(BoardGraph board, Guid playerId, Edge edge, NodeId nodeId)
    {
        var node = board.GetNode(nodeId);
        if (node.IsOccupied)
        {
            return node.OwnerId == playerId;
        }

        return node.Edges.Any(other => !other.Equals(edge.Id) && board.GetEdge(other).OwnerId == playerId);
    }

    private static bool IsVacantRespectingDistance(BoardGraph board, Node node) =>
        !node.IsOccupied && node.Neighbors.All(id => !board.GetNode(id).IsOccupied);

    private static bool CanAfford(IReadOnlyDictionary<string, int> hand, IReadOnlyDictionary<ResourceType, int> cost) =>
        cost.All(pair => hand.GetValueOrDefault(pair.Key.ToString()) >= pair.Value);

    private static bool CanAfford(IReadOnlyDictionary<string, int> hand, IReadOnlyDictionary<string, int> cost) =>
        cost.All(pair => hand.GetValueOrDefault(pair.Key) >= pair.Value);

    /// <summary>Expected production of an intersection: sum of dice-probability pips of its hexes.</summary>
    private static int Pips(BoardGraph board, Node node) =>
        node.Hexes.Select(board.GetHex).Sum(h => h is null ? 0 : HexPips(h));

    /// <summary>Small bonus for touching distinct resource types.</summary>
    private static int Diversity(BoardGraph board, Node node) =>
        node.Hexes.Select(board.GetHex).Select(h => h?.Produces).Where(r => r is not null).Distinct().Count();

    private static int HexPips(Hex hex) => hex.NumberToken switch
    {
        2 or 12 => 1,
        3 or 11 => 2,
        4 or 10 => 3,
        5 or 9 => 4,
        6 or 8 => 5,
        _ => 0,
    };
}
