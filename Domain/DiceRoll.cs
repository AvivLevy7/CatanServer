namespace CatanServer.Domain;

/// <summary>Result of rolling two six-sided dice.</summary>
public readonly record struct DiceRoll(int First, int Second)
{
    public int Total => First + Second;

    public bool ActivatesRobber => Total == 7;

    public static DiceRoll Roll(Random random) =>
        new(random.Next(1, 7), random.Next(1, 7));

    /// <summary>Rolls two dice, rerolling any 7 when <paramref name="allowSevens"/> is false.</summary>
    public static DiceRoll Roll(Random random, bool allowSevens)
    {
        DiceRoll roll;
        do
        {
            roll = Roll(random);
        }
        while (!allowSevens && roll.ActivatesRobber);

        return roll;
    }
}
