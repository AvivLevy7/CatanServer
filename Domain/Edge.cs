namespace CatanServer.Domain;

/// <summary>
/// A path between two intersections where roads are built.
/// </summary>
public sealed class Edge
{
    public Edge(EdgeId id, NodeId first, NodeId second)
    {
        Id = id;
        First = first;
        Second = second;
    }

    public EdgeId Id { get; }

    public NodeId First { get; }

    public NodeId Second { get; }

    public NodeId Other(NodeId node) => node.Equals(First) ? Second : First;
}
