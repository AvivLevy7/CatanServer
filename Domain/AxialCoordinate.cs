namespace CatanServer.Domain;

/// <summary>
/// Axial ("pointy-top") hex coordinate. Q runs east, R runs south-east.
/// </summary>
public readonly record struct AxialCoordinate(int Q, int R)
{
    public int S => -Q - R;

    private static readonly AxialCoordinate[] Directions =
    [
        new(1, 0), new(1, -1), new(0, -1),
        new(-1, 0), new(-1, 1), new(0, 1)
    ];

    public AxialCoordinate Neighbor(int direction) =>
        this + Directions[((direction % 6) + 6) % 6];

    public static AxialCoordinate operator +(AxialCoordinate a, AxialCoordinate b) =>
        new(a.Q + b.Q, a.R + b.R);
}
