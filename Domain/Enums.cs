namespace CatanServer.Domain;

public enum ResourceType
{
    Brick,
    Lumber,
    Ore,
    Grain,
    Wool
}

public enum HexType
{
    Hills,      // Brick
    Forest,     // Lumber
    Mountains,  // Ore
    Fields,     // Grain
    Pasture,    // Wool
    Desert
}

public enum HarborType
{
    None,
    Generic,    // 3:1
    Brick,
    Lumber,
    Ore,
    Grain,
    Wool
}

/// <summary>
/// The six corners of a pointy-top hex, ordered clockwise from the north corner.
/// </summary>
public enum HexCorner
{
    North,
    NorthEast,
    SouthEast,
    South,
    SouthWest,
    NorthWest
}
