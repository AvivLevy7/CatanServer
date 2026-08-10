using CatanServer.Contracts;

namespace CatanServer.Hubs;

/// <summary>
/// Strongly-typed contract for server-to-client calls. Keeps method names in one place
/// so the React client and the hub cannot drift apart silently.
/// </summary>
public interface IGameClient
{
    Task BoardState(BoardStateDto board);

    Task PlayerJoined(string connectionId);

    Task PlayerLeft(string connectionId);
}
