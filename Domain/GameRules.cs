namespace CatanServer.Domain;

/// <summary>
/// Raised when a player attempts an action the rules forbid. The message is safe to
/// forward to clients.
/// </summary>
public sealed class GameRuleException(string message) : InvalidOperationException(message);

/// <summary>Per-player piece supply from the standard box.</summary>
public static class PieceLimits
{
    public const int Roads = 15;
    public const int Settlements = 5;
    public const int Cities = 4;
}

/// <summary>Exchange rates with the bank.</summary>
public static class TradeRates
{
    /// <summary>Resources given per one received when no harbour applies.</summary>
    public const int Bank = 4;
}

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
