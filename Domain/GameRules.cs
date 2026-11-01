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

/// <summary>Bonus achievements worth 2 VP each.</summary>
public static class Achievements
{
    public const int BonusVictoryPoints = 2;
    public const int LargestArmyMinimum = 3;
    public const int LongestRoadMinimum = 5;
}

/// <summary>Exchange rates with the bank.</summary>
public static class TradeRates
{
    /// <summary>Resources given per one received when no harbour applies.</summary>
    public const int Bank = 4;

    /// <summary>Rate at a generic (3:1) harbour.</summary>
    public const int GenericHarbor = 3;

    /// <summary>Rate at a resource-specific (2:1) harbour, for that resource only.</summary>
    public const int ResourceHarbor = 2;
}

/// <summary>Timings for player-to-player offers.</summary>
public static class TradeRules
{
    /// <summary>
    /// How long an offer stays on the table before it withdraws itself. Short on purpose:
    /// an unanswered offer should not be able to stall the game.
    /// </summary>
    public static readonly TimeSpan OfferLifetime = TimeSpan.FromSeconds(15);
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

    public static readonly IReadOnlyDictionary<ResourceType, int> DevelopmentCard = new Dictionary<ResourceType, int>
    {
        [ResourceType.Ore] = 1,
        [ResourceType.Grain] = 1,
        [ResourceType.Wool] = 1
    };
}

/// <summary>Timings for taking a misclicked build back.</summary>
public static class BuildRules
{
    /// <summary>
    /// How long a road or settlement may be taken back for. Short on purpose: it covers a
    /// fat-fingered tap on a touchscreen, not a change of mind, and the game only offers it
    /// while nothing random (a card draw, a roll) has happened since.
    /// </summary>
    public static readonly TimeSpan UndoWindow = TimeSpan.FromSeconds(3);

    /// <summary>Slack past the window, so an undo sent as it closes still lands.</summary>
    public static readonly TimeSpan UndoGrace = TimeSpan.FromMilliseconds(900);
}
