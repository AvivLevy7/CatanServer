using CatanServer.Contracts;
using CatanServer.Services;
using Microsoft.AspNetCore.Mvc;

namespace CatanServer.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class BoardController : ControllerBase
{
    private readonly IGameStateService _gameState;

    public BoardController(IGameStateService gameState)
    {
        _gameState = gameState;
    }

    [HttpGet]
    public ActionResult<BoardStateDto> Get() => Ok(_gameState.GetBoardState());
}
