namespace CatanServer.Domain;

/// <summary>
/// A pending player-to-player trade. <see cref="TargetPlayerId"/> is null for an open
/// offer that any opponent may accept. Lives only until accepted, fully declined,
/// cancelled, or the proposer's turn ends.
/// </summary>
public sealed class TradeOffer
{
    private readonly HashSet<Guid> _declinedBy = [];

    public TradeOffer(
        Guid senderPlayerId,
        Guid? targetPlayerId,
        IReadOnlyDictionary<ResourceType, int> resourcesOffered,
        IReadOnlyDictionary<ResourceType, int> resourcesRequested)
    {
        OfferId = Guid.NewGuid();
        SenderPlayerId = senderPlayerId;
        TargetPlayerId = targetPlayerId;
        ResourcesOffered = resourcesOffered;
        ResourcesRequested = resourcesRequested;
    }

    public Guid OfferId { get; }

    public Guid SenderPlayerId { get; }

    public Guid? TargetPlayerId { get; }

    public IReadOnlyDictionary<ResourceType, int> ResourcesOffered { get; }

    public IReadOnlyDictionary<ResourceType, int> ResourcesRequested { get; }

    public IReadOnlySet<Guid> DeclinedBy => _declinedBy;

    public bool IsOpen => TargetPlayerId is null;

    public bool IsAddressedTo(Guid playerId) =>
        playerId != SenderPlayerId && (IsOpen || TargetPlayerId == playerId);

    internal void Decline(Guid playerId) => _declinedBy.Add(playerId);
}
