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

    /// <summary>
    /// Standard harbour ring: nine coastal edges, each identified by an outer hex and the
    /// side of that hex facing the sea (named by the two corners it joins). Walks clockwise
    /// from the top of the board; four 3:1 and five 2:1 like the printed frame pieces.
    /// </summary>
    private static readonly (AxialCoordinate Hex, HexCorner A, HexCorner B, HarborType Type)[] HarborLayout =
    [
        (new(0, -2), HexCorner.NorthWest, HexCorner.North, HarborType.Generic),
        (new(1, -2), HexCorner.North, HexCorner.NorthEast, HarborType.Wool),
        (new(2, -1), HexCorner.NorthEast, HexCorner.SouthEast, HarborType.Generic),
        (new(2, 0), HexCorner.NorthEast, HexCorner.SouthEast, HarborType.Grain),
        (new(1, 1), HexCorner.SouthEast, HexCorner.South, HarborType.Brick),
        (new(0, 2), HexCorner.SouthEast, HexCorner.South, HarborType.Generic),
        (new(-1, 2), HexCorner.South, HexCorner.SouthWest, HarborType.Lumber),
        (new(-2, 1), HexCorner.SouthWest, HexCorner.NorthWest, HarborType.Ore),
        (new(-1, -1), HexCorner.NorthWest, HexCorner.North, HarborType.Generic),
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

        var board = new BoardGraph(hexes);
        PlaceHarbors(board);
        return board;
    }

    /// <summary>Marks both intersections of each harbour edge.</summary>
    private static void PlaceHarbors(BoardGraph board)
    {
        foreach (var (hex, a, b, type) in HarborLayout)
        {
            foreach (var corner in new[] { a, b })
            {
                if (board.TryGetNode(NodeId.FromCorner(hex, corner), out var node))
                {
                    node.Harbor = type;
                }
            }
        }
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
