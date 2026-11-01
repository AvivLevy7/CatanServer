namespace CatanServer.Services;

/// <summary>
/// Clears out games nobody came back to.
///
/// A room is not dropped the moment its last player disconnects: everyone holds a session
/// token, and a refresh, a tunnel, or a phone locking itself are all a few seconds away
/// from reclaiming the same seat and the same hand. So an empty game is held, frozen (the
/// turn clock stops with nobody watching - see <see cref="TurnTimerService.Sync"/>), until
/// this sweep decides it really has been abandoned.
/// </summary>
public sealed class RoomReaperService : BackgroundService
{
    /// <summary>How long an empty game is kept in case its players come back.</summary>
    public static readonly TimeSpan AbandonedGrace = TimeSpan.FromMinutes(3);

    private static readonly TimeSpan SweepEvery = TimeSpan.FromSeconds(30);

    private readonly RoomManager _rooms;
    private readonly TurnTimerService _timers;
    private readonly TradeTimerService _tradeTimers;
    private readonly ILogger<RoomReaperService> _logger;

    public RoomReaperService(
        RoomManager rooms,
        TurnTimerService timers,
        TradeTimerService tradeTimers,
        ILogger<RoomReaperService> logger)
    {
        _rooms = rooms;
        _timers = timers;
        _tradeTimers = tradeTimers;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var ticker = new PeriodicTimer(SweepEvery);

        while (await ticker.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                foreach (var roomId in _rooms.ReapAbandoned(AbandonedGrace))
                {
                    // The room is gone, so its clocks have nothing left to fire for.
                    _timers.Stop(roomId);
                    _tradeTimers.Stop(roomId);
                    _logger.LogInformation(
                        "Room {RoomId} closed: empty for over {Minutes} minutes",
                        roomId, AbandonedGrace.TotalMinutes);
                }
            }
            catch (Exception ex)
            {
                // A failed sweep must never take the host down; the next one will try again.
                _logger.LogError(ex, "Room sweep failed");
            }
        }
    }
}
