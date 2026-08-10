namespace CatanServer.Domain;

/// <summary>
/// A single terrain tile. Topology is attached once by <see cref="BoardGraph"/>.
/// </summary>
public sealed class Hex
{
    private readonly List<NodeId> _nodes = new(6);
    private readonly List<EdgeId> _edges = new(6);

    public Hex(AxialCoordinate coordinate, HexType type, int? numberToken)
    {
        Coordinate = coordinate;
        Type = type;
        NumberToken = numberToken;
    }

    public AxialCoordinate Coordinate { get; }

    public HexType Type { get; }

    /// <summary>Dice token (2-12, never 7). Null for the desert.</summary>
    public int? NumberToken { get; }

    public bool HasRobber { get; internal set; }

    public IReadOnlyList<NodeId> Nodes => _nodes;

    public IReadOnlyList<EdgeId> Edges => _edges;

    public ResourceType? Produces => Type switch
    {
        HexType.Hills => ResourceType.Brick,
        HexType.Forest => ResourceType.Lumber,
        HexType.Mountains => ResourceType.Ore,
        HexType.Fields => ResourceType.Grain,
        HexType.Pasture => ResourceType.Wool,
        _ => null
    };

    internal void AttachTopology(IEnumerable<NodeId> nodes, IEnumerable<EdgeId> edges)
    {
        _nodes.Clear();
        _nodes.AddRange(nodes);
        _edges.Clear();
        _edges.AddRange(edges);
    }
}
