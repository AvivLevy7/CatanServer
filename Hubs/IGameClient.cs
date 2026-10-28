using CatanServer.Contracts;

namespace CatanServer.Hubs;

/// <summary>
/// Strongly-typed contract for server-to-client calls. Keeps method names in one place
/// so the React client and the hub cannot drift apart silently.
/// </summary>
public interface IGameClient
{
    /// <summary>Lobby membership/status for the caller's room.</summary>
    Task RoomState(RoomStateDto room);

    Task BoardState(BoardStateDto board);

    Task GameState(GameStateDto state);

    Task DiceRolled(DiceRolledDto roll);

    Task RobberMoved(RobberMovedDto robber);

    Task GameOver(PlayerDto winner);

    /// <summary>A new player-to-player offer is on the table.</summary>
    Task TradeOffered(TradeOfferDto offer);

    /// <summary>The offer was accepted, declined (by one or all) or withdrawn.</summary>
    Task TradeResolved(TradeResolvedDto result);

    Task PlayerJoined(string connectionId);

    Task PlayerLeft(string connectionId);
}
