namespace CatanServer.Contracts;

/// <summary>
/// Wire format for a single tile. Row/Col mirror the 3-4-5-4-3 layout the React
/// client renders, so the frontend needs no axial maths.
/// </summary>
public sealed record HexDto(
    int Q,
    int R,
    int Row,
    int Col,
    int RowLength,
    string Type,
    int? NumberToken,
    bool HasRobber)
{
    public string Id => $"{Q},{R}";
}

/// <summary>
/// Wire format for an intersection. AnchorHexId + AnchorCorner let the client place
/// the node exactly on a hex corner using the same geometry it uses for tiles.
/// </summary>
public sealed record NodeDto(
    string Id,
    string AnchorHexId,
    string AnchorCorner,
    Guid? OwnerId,
    string Building,
    string Harbor);

/// <summary>Wire format for a path between two intersections.</summary>
public sealed record EdgeDto(
    string Id,
    string NodeAId,
    string NodeBId,
    Guid? OwnerId);

/// <summary>Full board snapshot pushed to clients.</summary>
public sealed record BoardStateDto(
    Guid BoardId,
    IReadOnlyList<HexDto> Hexes,
    IReadOnlyList<NodeDto> Nodes,
    IReadOnlyList<EdgeDto> Edges);
