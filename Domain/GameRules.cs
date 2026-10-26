namespace CatanServer.Domain;

/// <summary>
/// Raised when a player attempts an action the rules forbid. The message is safe to
/// forward to clients.
/// </summary>
public sealed class GameRuleException(string message) : InvalidOperationException(message);

/// <summary>Standard building costs.</summary>
public static class BuildingCosts
{
    public static readonly IReadOnlyDictionary<ResourceType, int> Settlement = new Dictionary<ResourceType, int>
    {
        [ResourceType.Lumber] = 1,
        [ResourceType.Brick] = 1,
        [ResourceType.Grain] = 1,
        [ResourceType.Wool] = 1
    };

    public static readonly IReadOnlyDictionary<ResourceType, int> Road = new Dictionary<ResourceType, int>
    {
        [ResourceType.Lumber] = 1,
        [ResourceType.Brick] = 1
    };

    public static readonly IReadOnlyDictionary<ResourceType, int> City = new Dictionary<ResourceType, int>
    {
        [ResourceType.Grain] = 2,
        [ResourceType.Ore] = 3
    };
}
