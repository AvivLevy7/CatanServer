namespace CatanServer.Domain;

/// <summary>
/// A pending player-to-player trade. <see cref="TargetPlayerId"/> is null for an open
/// offer that any opponent may accept. Lives only until confirmed, fully declined,
/// cancelled, expired, or the proposer's turn ends.
///
/// Accepting is deliberately not the end of the deal: recipients mark themselves
/// interested, and the proposer then picks which of them to actually trade with. That
/// keeps the choice of partner with the person giving the cards away, so they can decline
/// to hand the leader exactly what they need.
/// </summary>
public sealed class TradeOffer
{
    private readonly HashSet<Guid> _declinedBy = [];
    private readonly HashSet<Guid> _acceptedBy = [];
    private readonly HashSet<Guid> _embargoedBy = [];

    public TradeOffer(
        Guid senderPlayerId,
        Guid? targetPlayerId,
        IReadOnlyDictionary<ResourceType, int> resourcesOffered,
        IReadOnlyDictionary<ResourceType, int> resourcesRequested,
        DateTimeOffset? expiresAt = null)
    {
        OfferId = Guid.NewGuid();
        SenderPlayerId = senderPlayerId;
        TargetPlayerId = targetPlayerId;
        ResourcesOffered = resourcesOffered;
        ResourcesRequested = resourcesRequested;
        ExpiresAt = expiresAt;
    }

    public Guid OfferId { get; }

    public Guid SenderPlayerId { get; }

    public Guid? TargetPlayerId { get; }

    public IReadOnlyDictionary<ResourceType, int> ResourcesOffered { get; }

    public IReadOnlyDictionary<ResourceType, int> ResourcesRequested { get; }

    /// <summary>When the table stops waiting and the offer withdraws itself. Null means no clock.</summary>
    public DateTimeOffset? ExpiresAt { get; }

    public IReadOnlySet<Guid> DeclinedBy => _declinedBy;

    /// <summary>Recipients who said yes and are waiting on the proposer to pick a partner.</summary>
    public IReadOnlySet<Guid> AcceptedBy => _acceptedBy;

    /// <summary>
    /// Recipients refusing on principle rather than on the terms - the bots' embargo of a
    /// player close to winning. Shown differently so the proposer knows the terms are not
    /// the problem.
    /// </summary>
    public IReadOnlySet<Guid> EmbargoedBy => _embargoedBy;

    public bool IsOpen => TargetPlayerId is null;

    /// <summary>
    /// One of the two bundles is empty. Such an offer is a legal opening gambit, but it cannot
    /// be accepted as it stands: giving cards away for nothing is not a trade.
    /// </summary>
    public bool IsOneSided => ResourcesOffered.Count == 0 || ResourcesRequested.Count == 0;

    public bool IsAddressedTo(Guid playerId) =>
        playerId != SenderPlayerId && (IsOpen || TargetPlayerId == playerId);

    internal void Decline(Guid playerId)
    {
        _declinedBy.Add(playerId);
        // Changing one's mind to "no" withdraws the earlier yes.
        _acceptedBy.Remove(playerId);
    }

    internal void Embargo(Guid playerId)
    {
        _embargoedBy.Add(playerId);
        Decline(playerId);
    }

    internal void Accept(Guid playerId)
    {
        _acceptedBy.Add(playerId);
        _declinedBy.Remove(playerId);
        _embargoedBy.Remove(playerId);
    }
}
