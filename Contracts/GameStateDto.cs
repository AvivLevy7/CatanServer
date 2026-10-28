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
    VictoryPointBreakdownDto VictoryPointBreakdown)
{
    /// <summary>Public view: same stats, but the hand itself is stripped (VP cards stay secret until the game ends).</summary>
    public PlayerDto Redacted(bool revealVictoryPointCards = false) => this with
    {
        Resources = null,
        DevelopmentCards = null,
        VictoryPointBreakdown = revealVictoryPointCards
            ? VictoryPointBreakdown
            : VictoryPointBreakdown with { VictoryPointCards = null },
    };
}

public sealed record BuildingDto(string NodeId, Guid OwnerId, string Type);

public sealed record RoadDto(string EdgeId, Guid OwnerId);

public sealed record DiceRollDto(int First, int Second, int Total);

/// <summary>Pending player-to-player offer; TargetPlayerId is null for an open offer.</summary>
public sealed record TradeOfferDto(
    Guid OfferId,
    Guid SenderPlayerId,
    Guid? TargetPlayerId,
    IReadOnlyDictionary<string, int> ResourcesOffered,
    IReadOnlyDictionary<string, int> ResourcesRequested,
    IReadOnlyList<Guid> DeclinedBy);

/// <summary>Sent to the proposer when an offer is accepted, declined or dropped.</summary>
public sealed record TradeResolvedDto(Guid OfferId, Guid? ByPlayerId, string Outcome);

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
    IReadOnlyDictionary<int, int> DiceRollFrequencies);

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

public sealed record ResourceGrantDto(Guid PlayerId, string Resource, int Amount);

/// <summary>Broadcast after a roll so clients can animate dice and resource gains.</summary>
public sealed record DiceRolledDto(
    Guid RolledBy,
    DiceRollDto Roll,
    IReadOnlyList<ResourceGrantDto> Production);

/// <summary>Server-generated announcement for the game log (timeouts, auto-actions).</summary>
public sealed record SystemMessageDto(string Text, string Tone, DateTimeOffset At);

/// <summary>A player's chat line, relayed to the whole room.</summary>
public sealed record ChatMessageDto(Guid Id, Guid SenderId, string SenderName, string Text, DateTimeOffset At);
