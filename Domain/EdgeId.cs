namespace CatanServer.Domain;

/// <summary>
/// Canonical identity of a path: the two intersections it connects, in a stable order.
/// </summary>
public readonly record struct EdgeId
{
    public NodeId A { get; }
    public NodeId B { get; }

    private EdgeId(NodeId a, NodeId b)
    {
        A = a;
        B = b;
    }

    public static EdgeId Between(NodeId first, NodeId second) =>
        Compare(first, second) <= 0 ? new EdgeId(first, second) : new EdgeId(second, first);

    private static int Compare(NodeId left, NodeId right)
    {
        var result = NodeId.Compare(left.A, right.A);
        if (result != 0)
        {
            return result;
        }

        result = NodeId.Compare(left.B, right.B);
        return result != 0 ? result : NodeId.Compare(left.C, right.C);
    }

    public override string ToString() => $"E[{A}->{B}]";
}
