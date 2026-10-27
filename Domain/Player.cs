namespace CatanServer.Domain;

public enum PlayerColor
{
    Red,
    Blue,
    Orange,
    White
}

/// <summary>
/// A participant in the game. Resources are mutated only through the aggregate so the
/// wallet can never go negative or hold an unknown resource type.
/// </summary>
public sealed class Player
{
    private readonly Dictionary<ResourceType, int> _resources =
        Enum.GetValues<ResourceType>().ToDictionary(type => type, _ => 0);

    private readonly List<DevelopmentCard> _developmentCards = [];

    public Player(Guid id, string name, PlayerColor color)
    {
        Id = id;
        Name = name;
        Color = color;
    }

    public Guid Id { get; }

    public string Name { get; }

    public PlayerColor Color { get; }

    public int VictoryPoints { get; private set; }

    public IReadOnlyDictionary<ResourceType, int> Resources => _resources;

    public int TotalResourceCount => _resources.Values.Sum();

    public IReadOnlyList<DevelopmentCard> DevelopmentCards => _developmentCards;

    /// <summary>Knights played so far; drives Largest Army.</summary>
    public int KnightsPlayed { get; private set; }

    internal void AddDevelopmentCard(DevelopmentCard card) => _developmentCards.Add(card);

    internal DevelopmentCard? FindDevelopmentCard(Guid cardId) =>
        _developmentCards.FirstOrDefault(card => card.Id == cardId);

    internal void RecordKnightPlayed() => KnightsPlayed++;

    internal void AddResources(ResourceType type, int amount)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(amount);
        _resources[type] += amount;
    }

    public bool CanAfford(IReadOnlyDictionary<ResourceType, int> cost) =>
        cost.All(pair => _resources[pair.Key] >= pair.Value);

    internal void Pay(IReadOnlyDictionary<ResourceType, int> cost)
    {
        if (!CanAfford(cost))
        {
            throw new GameRuleException($"{Name} cannot afford this purchase.");
        }

        foreach (var (type, amount) in cost)
        {
            _resources[type] -= amount;
        }
    }

    internal bool TryRemoveResources(ResourceType type, int amount)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(amount);
        if (_resources[type] < amount)
        {
            return false;
        }

        _resources[type] -= amount;
        return true;
    }

    internal void AwardVictoryPoints(int points)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(points);
        VictoryPoints += points;
    }

    internal void RevokeVictoryPoints(int points)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(points);
        VictoryPoints = Math.Max(0, VictoryPoints - points);
    }
}
