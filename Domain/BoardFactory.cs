namespace CatanServer.Domain;

/// <summary>
/// Generates the classic 19-tile Catan board with a shuffled terrain and token layout.
/// </summary>
public static class BoardFactory
{
    private const int Radius = 2;

    /// <summary>
    /// Empty coastal edges required between two harbours. Two keeps ports apart and also
    /// guarantees no non-port edge ever joins two intersections of the same harbour type.
    /// </summary>
    private const int MinHarborGap = 2;

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


    /// <summary>Four 3:1 harbours plus one 2:1 harbour per resource.</summary>
    private static readonly HarborType[] HarborPool =
    [
        HarborType.Generic, HarborType.Generic, HarborType.Generic, HarborType.Generic,
        HarborType.Brick, HarborType.Lumber, HarborType.Ore, HarborType.Grain, HarborType.Wool,
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
        PlaceHarbors(board, random);
        return board;
    }

    /// <summary>
    /// Places the nine harbours on random coastal edges such that no two harbours touch:
    /// there is always at least one harbour-free coastal edge between neighbouring ports.
    /// The harbour types are shuffled independently of the positions.
    /// </summary>
    private static void PlaceHarbors(BoardGraph board, Random random)
    {
        var coast = CoastalRing(board);
        var types = Shuffle(HarborPool, random);

        if (coast.Count < types.Length * (MinHarborGap + 1))
        {
            throw new InvalidOperationException("Not enough coastline to space the harbours apart.");
        }

        // Every port owns one edge plus at least MinHarborGap empty edges after it; the
        // surplus empty edges are sprinkled randomly across the gaps, then the whole
        // pattern is rotated.
        var gaps = new int[types.Length];
        Array.Fill(gaps, MinHarborGap);
        for (var spare = coast.Count - types.Length * (MinHarborGap + 1); spare > 0; spare--)
        {
            gaps[random.Next(gaps.Length)]++;
        }

        var position = random.Next(coast.Count);
        for (var i = 0; i < types.Length; i++)
        {
            var edge = coast[position % coast.Count];
            board.GetNode(edge.First).Harbor = types[i];
            board.GetNode(edge.Second).Harbor = types[i];
            position += 1 + gaps[i];
        }
    }

    /// <summary>
    /// The coastal edges in walking order around the island. An edge is coastal when its
    /// two intersections share exactly one on-board hex (the other side is sea).
    /// </summary>
    private static List<Edge> CoastalRing(BoardGraph board)
    {
        var coastal = board.Edges
            .Where(edge => board.GetNode(edge.First).Hexes.Intersect(board.GetNode(edge.Second).Hexes).Count() == 1)
            .ToDictionary(edge => edge.Id);

        var ring = new List<Edge>(coastal.Count);
        var total = coastal.Count;
        var current = coastal.Values.First();
        var previousNode = current.First;

        while (ring.Count < total)
        {
            ring.Add(current);
            coastal.Remove(current.Id);

            var pivot = current.Other(previousNode);
            var next = board.GetNode(pivot).Edges
                .Where(coastal.ContainsKey)
                .Select(id => coastal[id])
                .FirstOrDefault();

            if (next is null)
            {
                break;
            }

            previousNode = pivot;
            current = next;
        }

        return ring;
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
