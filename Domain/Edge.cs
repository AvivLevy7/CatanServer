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

    public Guid? OwnerId { get; private set; }

    public bool HasRoad => OwnerId is not null;

    public NodeId Other(NodeId node) => node.Equals(First) ? Second : First;

    internal void PlaceRoad(Guid ownerId) => OwnerId = ownerId;

    internal void Clear() => OwnerId = null;
}
