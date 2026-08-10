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

/// <summary>Full board snapshot pushed to clients.</summary>
public sealed record BoardStateDto(Guid BoardId, IReadOnlyList<HexDto> Hexes);
