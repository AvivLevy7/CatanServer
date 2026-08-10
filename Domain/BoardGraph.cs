namespace CatanServer.Domain;

/// <summary>
/// The immutable board topology: tiles plus the intersection/path graph derived from them.
/// Ownership of buildings and roads lives in the game state, not here.
/// </summary>
public sealed class BoardGraph
{
    private readonly Dictionary<AxialCoordinate, Hex> _hexes;
    private readonly Dictionary<NodeId, Node> _nodes = [];
    private readonly Dictionary<EdgeId, Edge> _edges = [];

    public BoardGraph(IEnumerable<Hex> hexes)
    {
        _hexes = hexes.ToDictionary(hex => hex.Coordinate);
        BuildTopology();
    }

    public IReadOnlyCollection<Hex> Hexes => _hexes.Values;

    public IReadOnlyCollection<Node> Nodes => _nodes.Values;

    public IReadOnlyCollection<Edge> Edges => _edges.Values;

    public Hex? GetHex(AxialCoordinate coordinate) => _hexes.GetValueOrDefault(coordinate);

    public Node GetNode(NodeId id) => _nodes[id];

    public Edge GetEdge(EdgeId id) => _edges[id];

    /// <summary>Hexes that pay out when <paramref name="roll"/> is rolled.</summary>
    public IEnumerable<Hex> HexesWithToken(int roll) =>
        _hexes.Values.Where(hex => hex.NumberToken == roll);

    private void BuildTopology()
    {
        var corners = Enum.GetValues<HexCorner>();

        foreach (var hex in _hexes.Values)
        {
            var hexNodes = corners.Select(corner => NodeId.FromCorner(hex.Coordinate, corner)).ToArray();
            var hexEdges = new EdgeId[hexNodes.Length];

            for (var i = 0; i < hexNodes.Length; i++)
            {
                var current = GetOrAddNode(hexNodes[i]);
                var nextId = hexNodes[(i + 1) % hexNodes.Length];
                var next = GetOrAddNode(nextId);

                current.LinkHex(hex.Coordinate);
                current.LinkNeighbor(nextId);
                next.LinkNeighbor(current.Id);

                var edgeId = EdgeId.Between(current.Id, nextId);
                if (!_edges.ContainsKey(edgeId))
                {
                    _edges[edgeId] = new Edge(edgeId, current.Id, nextId);
                }

                current.LinkEdge(edgeId);
                next.LinkEdge(edgeId);
                hexEdges[i] = edgeId;
            }

            hex.AttachTopology(hexNodes, hexEdges);
        }
    }

    private Node GetOrAddNode(NodeId id)
    {
        if (!_nodes.TryGetValue(id, out var node))
        {
            node = new Node(id);
            _nodes[id] = node;
        }

        return node;
    }
}
