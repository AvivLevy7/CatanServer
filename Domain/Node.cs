namespace CatanServer.Domain;

/// <summary>
/// An intersection where settlements and cities are placed.
/// </summary>
public sealed class Node
{
    private readonly HashSet<AxialCoordinate> _hexes = [];
    private readonly HashSet<EdgeId> _edges = [];
    private readonly HashSet<NodeId> _neighbors = [];

    public Node(NodeId id)
    {
        Id = id;
    }

    public NodeId Id { get; }

    public HarborType Harbor { get; internal set; } = HarborType.None;

    /// <summary>Board hexes touching this intersection (one to three).</summary>
    public IReadOnlyCollection<AxialCoordinate> Hexes => _hexes;

    public IReadOnlyCollection<EdgeId> Edges => _edges;

    /// <summary>Adjacent intersections, used later for the distance rule and longest road.</summary>
    public IReadOnlyCollection<NodeId> Neighbors => _neighbors;

    internal void LinkHex(AxialCoordinate hex) => _hexes.Add(hex);

    internal void LinkEdge(EdgeId edge) => _edges.Add(edge);

    internal void LinkNeighbor(NodeId node)
    {
        if (!node.Equals(Id))
        {
            _neighbors.Add(node);
        }
    }
}
