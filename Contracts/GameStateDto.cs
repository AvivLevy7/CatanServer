namespace CatanServer.Contracts;

public sealed record DevelopmentCardDto(Guid Id, string Type, bool IsPlayed, bool CanPlayNow);

/// <summary>Where a player's victory points come from. Public except VictoryPointCards, which is hidden for opponents until Game Over.</summary>
public sealed record VictoryPointBreakdownDto(
    int Settlements,
    int Cities,
    int LongestRoad,
    int LargestArmy,
    int? VictoryPointCards);

/// <summary>
/// A seat. <see cref="Resources"/> and <see cref="DevelopmentCards"/> are the player's private
/// hand and are null when projected for anyone else; the counts are always public.
/// </summary>
public sealed record PlayerDto(
    Guid Id,
    string Name,
    string Color,
    int VictoryPoints,
    IReadOnlyDictionary<string, int>? Resources,
    int RoadsRemaining,
    int SettlementsRemaining,
    int CitiesRemaining,
    IReadOnlyList<DevelopmentCardDto>? DevelopmentCards,
    int KnightsPlayed,
    int LongestRoadLength,
    IReadOnlyDictionary<string, int> BankRates,
    int ResourceCardCount,
    int UnplayedDevCardCount,
    int PlayedDevCardCount,
    VictoryPointBreakdownDto VictoryPointBreakdown)
{
    /// <summary>
    /// Public view: same stats, but the hand itself is stripped. Until the game ends the
    /// victory-point cards are secret, so they are removed from both the breakdown and the
    /// total - opponents only ever see the points visible on the board plus achievements.
    /// </summary>
    public PlayerDto Redacted(bool revealVictoryPointCards = false) => this with
    {
        Resources = null,
        DevelopmentCards = null,
        VictoryPoints = revealVictoryPointCards
            ? VictoryPoints
            : VictoryPoints - (VictoryPointBreakdown.VictoryPointCards ?? 0),
        VictoryPointBreakdown = revealVictoryPointCards
            ? VictoryPointBreakdown
            : VictoryPointBreakdown with { VictoryPointCards = null },
    };
}

public sealed record BuildingDto(string NodeId, Guid OwnerId, string Type);

public sealed record RoadDto(string EdgeId, Guid OwnerId);

public sealed record DiceRollDto(int First, int Second, int Total);

/// <summary>
/// Pending player-to-player offer; TargetPlayerId is null for an open offer.
/// <paramref name="AcceptedBy"/> are the players waiting on the proposer to pick a partner,
/// <paramref name="EmbargoedBy"/> those refusing on principle rather than on the terms, and
/// <paramref name="ExpiresAt"/> is when the offer withdraws itself.
/// </summary>
public sealed record TradeOfferDto(
    Guid OfferId,
    Guid SenderPlayerId,
    Guid? TargetPlayerId,
    IReadOnlyDictionary<string, int> ResourcesOffered,
    IReadOnlyDictionary<string, int> ResourcesRequested,
    IReadOnlyList<Guid> DeclinedBy,
    IReadOnlyList<Guid> AcceptedBy,
    IReadOnlyList<Guid> EmbargoedBy,
    DateTimeOffset? ExpiresAt);

/// <summary>
/// Sent to the table when an offer is accepted, declined, confirmed or dropped.
/// <paramref name="Offer"/> is carried on a confirmation so clients can report what actually
/// changed hands - by then the offer itself has been cleared from the game state.
/// </summary>
public sealed record TradeResolvedDto(Guid OfferId, Guid? ByPlayerId, string Outcome, TradeOfferDto? Offer = null);

/// <summary>Full match snapshot: board plus players, buildings, roads and turn info. Server-side only; never sent raw.</summary>
public record GameStateDto(
    Guid GameId,
    BoardStateDto Board,
    IReadOnlyList<PlayerDto> Players,
    IReadOnlyList<BuildingDto> Buildings,
    IReadOnlyList<RoadDto> Roads,
    Guid CurrentTurnPlayerId,
    DiceRollDto? LastRoll,
    string Phase,
    string SetupStep,
    string? PendingSetupSettlementNodeId,
    string RobberHexId,
    Guid? RobberMoverId,
    IReadOnlyDictionary<Guid, int> PendingDiscards,
    int DevelopmentCardsRemaining,
    int TurnNumber,
    int FreeRoadsRemaining,
    Guid? WinnerId,
    Guid? LargestArmyHolderId,
    Guid? LongestRoadHolderId,
    int LongestRoadLength,
    TradeOfferDto? ActiveTradeOffer,
    bool AllowSevens,
    bool HasRolledDice,
    DateTimeOffset? TurnDeadline,
    IReadOnlyDictionary<int, int> DiceRollFrequencies,
    IReadOnlyList<string> LongestRoadPath,
    UndoableBuildDto? UndoableBuild,
    int TurnClockSeconds,
    bool TurnDeadlineExtended);

/// <summary>
/// A road or settlement the player whose turn it is may still take back, and until when.
/// Public, because the piece appearing and vanishing again is visible to the whole table.
/// </summary>
public sealed record UndoableBuildDto(Guid PlayerId, string Kind, string PieceId, DateTimeOffset ExpiresAt);

/// <summary>What one victim lost to a Monopoly.</summary>
public sealed record MonopolyTakeDto(Guid FromPlayerId, int Amount);

/// <summary>
/// Broadcast when a Monopoly is played, so every screen can drain the cards out of the
/// victims' seats and into the caller's hand.
/// </summary>
public sealed record MonopolyPlayedDto(
    Guid PlayerId,
    string PlayerName,
    string Resource,
    int Collected,
    IReadOnlyList<MonopolyTakeDto> Takes);

/// <summary>
/// What one player is allowed to see: their own hand in full, every opponent reduced to
/// public counts. Built from a <see cref="GameStateDto"/> right before it leaves the server.
/// </summary>
public sealed record ClientGameStateDto : GameStateDto
{
    public ClientGameStateDto(GameStateDto full, Guid viewerId)
        : base(full)
    {
        ViewerId = viewerId;
        var gameOver = full.Phase == "GameOver";
        Players = full.Players
            .Select(p => p.Id == viewerId ? p : p.Redacted(revealVictoryPointCards: gameOver))
            .ToList();
    }

    public Guid ViewerId { get; }
}

/// <summary>Broadcast when the robber steals so clients can show who lost what.</summary>
public sealed record RobberMovedDto(Guid MovedBy, string HexId, Guid? VictimId, string? StolenResource);

/// <summary>
/// Resources handed to one player by one hex. <paramref name="HexId"/> is the producing
/// tile ("q,r") so the client can fly the icons from that hex to the receiving seat.
/// </summary>
public sealed record ResourceGrantDto(Guid PlayerId, string Resource, int Amount, string HexId);

/// <summary>Broadcast after a roll so clients can animate dice and resource gains.</summary>
public sealed record DiceRolledDto(
    Guid RolledBy,
    DiceRollDto Roll,
    IReadOnlyList<ResourceGrantDto> Production);

/// <summary>Server-generated announcement for the game log (timeouts, auto-actions).</summary>
public sealed record SystemMessageDto(string Text, string Tone, DateTimeOffset At);

/// <summary>A player's chat line, relayed to the whole room.</summary>
public sealed record ChatMessageDto(Guid Id, Guid SenderId, string SenderName, string Text, DateTimeOffset At);

/// <summary>
/// A quick visual reaction from one seat. <paramref name="Emote"/> is one of
/// <see cref="Emotes.Allowed"/>; the client maps it to a glyph and a speech bubble.
/// </summary>
public sealed record EmoteDto(Guid Id, Guid SenderId, string SenderName, string Emote, DateTimeOffset At);

/// <summary>
/// What a seat is currently doing with the live trade offer, so everyone can see who is
/// still thinking. <paramref name="Activity"/> is one of <see cref="Negotiation.Allowed"/>.
/// </summary>
public sealed record NegotiationStatusDto(Guid PlayerId, string Activity);

/// <summary>Emote vocabulary. The hub rejects anything outside this set.</summary>
public static class Emotes
{
    public static readonly IReadOnlySet<string> Allowed = new HashSet<string>(StringComparer.Ordinal)
    {
        "BeggingSheep",
        "AngryRobber",
        "Thanks",
        "HurryUp",
        "ThumbsUp",
        "Taunt",
    };
}

/// <summary>
/// What a seat is advertising it wants and what it will part with, set from their own hand
/// and shown beside every seat chip. Either side may be null for "nothing in particular".
/// </summary>
public sealed record TradeWishlistDto(Guid PlayerId, string? Wants, string? Offers);

/// <summary>Negotiation vocabulary: looking at an offer, drafting a counter, or done.</summary>
public static class Negotiation
{
    public const string None = "None";
    public const string Inspecting = "Inspecting";
    public const string Countering = "Countering";

    public static readonly IReadOnlySet<string> Allowed = new HashSet<string>(StringComparer.Ordinal)
    {
        None,
        Inspecting,
        Countering,
    };
}
