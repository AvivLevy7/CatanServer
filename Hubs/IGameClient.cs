using CatanServer.Contracts;

namespace CatanServer.Hubs;

/// <summary>
/// Strongly-typed contract for server-to-client calls. Keeps method names in one place
/// so the React client and the hub cannot drift apart silently.
/// </summary>
public interface IGameClient
{
    Task BoardState(BoardStateDto board);

    Task GameState(GameStateDto state);

    Task DiceRolled(DiceRolledDto roll);

    Task RobberMoved(RobberMovedDto robber);

    Task GameOver(PlayerDto winner);

    Task PlayerJoined(string connectionId);

    Task PlayerLeft(string connectionId);
}
