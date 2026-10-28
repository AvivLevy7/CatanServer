namespace CatanServer.Contracts;

public sealed record DevelopmentCardDto(Guid Id, string Type, bool IsPlayed, bool CanPlayNow);

public sealed record PlayerDto(
    Guid Id,
    string Name,
    string Color,
    int VictoryPoints,
    IReadOnlyDictionary<string, int> Resources,
    int RoadsRemaining,
    int SettlementsRemaining,
    int CitiesRemaining,
    IReadOnlyList<DevelopmentCardDto> DevelopmentCards,
    int KnightsPlayed,
    int LongestRoadLength,
    IReadOnlyDictionary<string, int> BankRates);

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

/// <summary>Full match snapshot: board plus players, buildings, roads and turn info.</summary>
public sealed record GameStateDto(
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
    bool HasRolledDice);

/// <summary>Broadcast when the robber steals so clients can show who lost what.</summary>
public sealed record RobberMovedDto(Guid MovedBy, string HexId, Guid? VictimId, string? StolenResource);

public sealed record ResourceGrantDto(Guid PlayerId, string Resource, int Amount);

/// <summary>Broadcast after a roll so clients can animate dice and resource gains.</summary>
public sealed record DiceRolledDto(
    Guid RolledBy,
    DiceRollDto Roll,
    IReadOnlyList<ResourceGrantDto> Production);
