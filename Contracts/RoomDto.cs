namespace CatanServer.Contracts;

public sealed record LobbyPlayerDto(Guid Id, string Name, string Color, bool IsHost, bool IsConnected, bool IsBot = false);

/// <summary>Room snapshot pushed to everyone in the room whenever membership or status changes.</summary>
public sealed record RoomStateDto(
    string RoomId,
    string Status,
    Guid HostPlayerId,
    IReadOnlyList<LobbyPlayerDto> Players,
    int MaxPlayers,
    int MinPlayers);

/// <summary>
/// Returned to the caller of CreateRoom / JoinRoom / RejoinRoom so it knows who it is.
/// <paramref name="SessionToken"/> is the secret that lets this browser claim the same seat
/// again after a refresh or a dropped connection; it is only ever sent to its own owner.
/// </summary>
public sealed record JoinedRoomDto(string RoomId, Guid PlayerId, string SessionToken, RoomStateDto Room);
