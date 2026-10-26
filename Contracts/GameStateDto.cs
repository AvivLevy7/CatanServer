namespace CatanServer.Contracts;

public sealed record PlayerDto(
    Guid Id,
    string Name,
    string Color,
    int VictoryPoints,
    IReadOnlyDictionary<string, int> Resources);

public sealed record BuildingDto(string NodeId, Guid OwnerId, string Type);

public sealed record RoadDto(string EdgeId, Guid OwnerId);

public sealed record DiceRollDto(int First, int Second, int Total);

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
    string? PendingSetupSettlementNodeId);

public sealed record ResourceGrantDto(Guid PlayerId, string Resource, int Amount);

/// <summary>Broadcast after a roll so clients can animate dice and resource gains.</summary>
public sealed record DiceRolledDto(
    Guid RolledBy,
    DiceRollDto Roll,
    IReadOnlyList<ResourceGrantDto> Production);
