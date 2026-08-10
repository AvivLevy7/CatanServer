namespace CatanServer.Domain;

/// <summary>
/// Generates the classic 19-tile Catan board with a shuffled terrain and token layout.
/// </summary>
public static class BoardFactory
{
    private const int Radius = 2;

    private static readonly HexType[] TerrainPool =
    [
        HexType.Desert,
        HexType.Hills, HexType.Hills, HexType.Hills,
        HexType.Mountains, HexType.Mountains, HexType.Mountains,
        HexType.Forest, HexType.Forest, HexType.Forest, HexType.Forest,
        HexType.Fields, HexType.Fields, HexType.Fields, HexType.Fields,
        HexType.Pasture, HexType.Pasture, HexType.Pasture, HexType.Pasture
    ];

    private static readonly int[] TokenPool =
    [
        2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12
    ];

    public static BoardGraph CreateStandardBoard(Random? random = null)
    {
        random ??= Random.Shared;

        var coordinates = EnumerateCoordinates().ToArray();
        var terrain = Shuffle(TerrainPool, random);
        var tokens = Shuffle(TokenPool, random);

        var hexes = new List<Hex>(coordinates.Length);
        var tokenIndex = 0;

        for (var i = 0; i < coordinates.Length; i++)
        {
            var type = terrain[i];
            int? token = type == HexType.Desert ? null : tokens[tokenIndex++];

            hexes.Add(new Hex(coordinates[i], type, token)
            {
                HasRobber = type == HexType.Desert
            });
        }

        return new BoardGraph(hexes);
    }

    private static IEnumerable<AxialCoordinate> EnumerateCoordinates()
    {
        for (var q = -Radius; q <= Radius; q++)
        {
            var rMin = Math.Max(-Radius, -q - Radius);
            var rMax = Math.Min(Radius, -q + Radius);

            for (var r = rMin; r <= rMax; r++)
            {
                yield return new AxialCoordinate(q, r);
            }
        }
    }

    private static T[] Shuffle<T>(T[] source, Random random)
    {
        var copy = source.ToArray();
        random.Shuffle(copy);
        return copy;
    }
}
