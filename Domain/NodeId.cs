namespace CatanServer.Domain;

/// <summary>
/// Canonical identity of an intersection: the sorted set of the three hexes touching it.
/// Border corners touch fewer real hexes, but the virtual off-board coordinates still
/// participate in the key so the identity stays unique and stable regardless of which
/// hex computes it.
/// </summary>
public readonly record struct NodeId
{
    public AxialCoordinate A { get; }
    public AxialCoordinate B { get; }
    public AxialCoordinate C { get; }

    private NodeId(AxialCoordinate a, AxialCoordinate b, AxialCoordinate c)
    {
        A = a;
        B = b;
        C = c;
    }

    public static NodeId FromCorner(AxialCoordinate hex, HexCorner corner)
    {
        // Each corner is shared by the hex itself and two of its six neighbours.
        var (first, second) = corner switch
        {
            HexCorner.North => (5, 0),
            HexCorner.NorthEast => (0, 1),
            HexCorner.SouthEast => (1, 2),
            HexCorner.South => (2, 3),
            HexCorner.SouthWest => (3, 4),
            HexCorner.NorthWest => (4, 5),
            _ => throw new ArgumentOutOfRangeException(nameof(corner))
        };

        return Create(hex, hex.Neighbor(first), hex.Neighbor(second));
    }

    private static NodeId Create(AxialCoordinate x, AxialCoordinate y, AxialCoordinate z)
    {
        Span<AxialCoordinate> parts = [x, y, z];
        Sort(parts);
        return new NodeId(parts[0], parts[1], parts[2]);
    }

    private static void Sort(Span<AxialCoordinate> parts)
    {
        for (var i = 1; i < parts.Length; i++)
        {
            for (var j = i; j > 0 && Compare(parts[j], parts[j - 1]) < 0; j--)
            {
                (parts[j], parts[j - 1]) = (parts[j - 1], parts[j]);
            }
        }
    }

    internal static int Compare(AxialCoordinate left, AxialCoordinate right) =>
        left.Q != right.Q ? left.Q.CompareTo(right.Q) : left.R.CompareTo(right.R);

    public override string ToString() => $"N[{A.Q},{A.R}|{B.Q},{B.R}|{C.Q},{C.R}]";
}
