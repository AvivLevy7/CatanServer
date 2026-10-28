using CatanServer.Contracts;
using CatanServer.Services;
using Microsoft.AspNetCore.Mvc;

namespace CatanServer.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class BoardController : ControllerBase
{
    private readonly RoomManager _rooms;

    public BoardController(RoomManager rooms)
    {
        _rooms = rooms;
    }

    /// <summary>Board for a given room code, e.g. GET /api/board/ABCD.</summary>
    [HttpGet("{roomId}")]
    public ActionResult<BoardStateDto> Get(string roomId) =>
        _rooms.TryGet(roomId, out var room) ? Ok(room.Game.GetBoardState()) : NotFound();
}
