namespace CatanServer.Domain;

public enum BuildingType
{
    None,
    Settlement,
    City
}

/// <summary>
/// Read model of a settlement or city occupying an intersection.
/// </summary>
public sealed record Building(NodeId Node, Guid OwnerId, BuildingType Type)
{
    /// <summary>Resource cards produced per adjacent hex when its number is rolled.</summary>
    public int Yield => Type == BuildingType.City ? 2 : 1;

    public int VictoryPoints => Type == BuildingType.City ? 2 : 1;
}

/// <summary>Read model of a road occupying a path.</summary>
public sealed record Road(EdgeId Edge, Guid OwnerId);
