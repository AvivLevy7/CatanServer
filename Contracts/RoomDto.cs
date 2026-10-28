namespace CatanServer.Contracts;

public sealed record LobbyPlayerDto(Guid Id, string Name, string Color, bool IsHost, bool IsConnected);

/// <summary>Room snapshot pushed to everyone in the room whenever membership or status changes.</summary>
public sealed record RoomStateDto(
    string RoomId,
    string Status,
    Guid HostPlayerId,
    IReadOnlyList<LobbyPlayerDto> Players,
    int MaxPlayers,
    int MinPlayers);

/// <summary>Returned to the caller of CreateRoom / JoinRoom so it knows who it is.</summary>
public sealed record JoinedRoomDto(string RoomId, Guid PlayerId, RoomStateDto Room);
