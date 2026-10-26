namespace CatanServer.Domain;

/// <summary>
/// An intersection where settlements and cities are placed.
/// </summary>
public sealed class Node
{
    private readonly HashSet<AxialCoordinate> _hexes = [];
    private readonly HashSet<EdgeId> _edges = [];
    private readonly HashSet<NodeId> _neighbors = [];

    public Node(NodeId id, AxialCoordinate anchorHex, HexCorner anchorCorner)
    {
        Id = id;
        AnchorHex = anchorHex;
        AnchorCorner = anchorCorner;
    }

    public NodeId Id { get; }

    /// <summary>An on-board hex touching this node, plus which of its corners it is. Used for rendering.</summary>
    public AxialCoordinate AnchorHex { get; }

    public HexCorner AnchorCorner { get; }

    public HarborType Harbor { get; internal set; } = HarborType.None;

    public Guid? OwnerId { get; private set; }

    public BuildingType Building { get; private set; } = BuildingType.None;

    public bool IsOccupied => Building != BuildingType.None;

    /// <summary>Board hexes touching this intersection (one to three).</summary>
    public IReadOnlyCollection<AxialCoordinate> Hexes => _hexes;

    public IReadOnlyCollection<EdgeId> Edges => _edges;

    /// <summary>Adjacent intersections, used later for the distance rule and longest road.</summary>
    public IReadOnlyCollection<NodeId> Neighbors => _neighbors;

    internal void LinkHex(AxialCoordinate hex) => _hexes.Add(hex);

    internal void Occupy(Guid ownerId, BuildingType building)
    {
        if (building == BuildingType.None)
        {
            throw new ArgumentException("Use Clear to vacate a node.", nameof(building));
        }

        OwnerId = ownerId;
        Building = building;
    }

    internal void Clear()
    {
        OwnerId = null;
        Building = BuildingType.None;
    }

    internal void LinkEdge(EdgeId edge) => _edges.Add(edge);

    internal void LinkNeighbor(NodeId node)
    {
        if (!node.Equals(Id))
        {
            _neighbors.Add(node);
        }
    }
}
