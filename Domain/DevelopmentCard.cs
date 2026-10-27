namespace CatanServer.Domain;

public enum DevelopmentCardType
{
    Knight,
    VictoryPoint,
    Monopoly,
    YearOfPlenty,
    RoadBuilding
}

/// <summary>
/// A development card in a player's hand. <see cref="BoughtOnTurn"/> enforces the
/// "cannot play on the turn it was bought" rule; <see cref="IsPlayed"/> keeps the card
/// visible for scoring and the Largest Army count.
/// </summary>
public sealed class DevelopmentCard
{
    public DevelopmentCard(Guid id, DevelopmentCardType type, int boughtOnTurn)
    {
        Id = id;
        Type = type;
        BoughtOnTurn = boughtOnTurn;
    }

    public Guid Id { get; }

    public DevelopmentCardType Type { get; }

    /// <summary>Global turn counter value when the card was drawn.</summary>
    public int BoughtOnTurn { get; }

    public bool IsPlayed { get; private set; }

    public bool CanPlayOnTurn(int currentTurn) =>
        !IsPlayed && Type != DevelopmentCardType.VictoryPoint && BoughtOnTurn < currentTurn;

    internal void MarkPlayed() => IsPlayed = true;
}

/// <summary>Shuffled draw pile from the standard box (25 cards).</summary>
public sealed class DevelopmentDeck
{
    private static readonly DevelopmentCardType[] Composition =
    [
        .. Enumerable.Repeat(DevelopmentCardType.Knight, 14),
        .. Enumerable.Repeat(DevelopmentCardType.VictoryPoint, 5),
        .. Enumerable.Repeat(DevelopmentCardType.Monopoly, 2),
        .. Enumerable.Repeat(DevelopmentCardType.YearOfPlenty, 2),
        .. Enumerable.Repeat(DevelopmentCardType.RoadBuilding, 2)
    ];

    private readonly Stack<DevelopmentCardType> _cards;

    public DevelopmentDeck(Random random)
    {
        var shuffled = Composition.ToArray();
        random.Shuffle(shuffled);
        _cards = new Stack<DevelopmentCardType>(shuffled);
    }

    public int Remaining => _cards.Count;

    public bool TryDraw(out DevelopmentCardType type) => _cards.TryPop(out type);
}
