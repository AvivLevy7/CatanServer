// Pip positions on a 3x3 grid (row, col) for each die face.
const PIP_LAYOUT = {
  1: [[1, 1]],
  2: [[0, 2], [2, 0]],
  3: [[0, 2], [1, 1], [2, 0]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

function Die({ value }) {
  const pips = PIP_LAYOUT[value] ?? [];

  return (
    <span
      className="grid size-14 grid-cols-3 grid-rows-3 gap-0.5 rounded-lg bg-amber-50 p-2 shadow-inner"
      role="img"
      aria-label={`Die showing ${value}`}
    >
      {Array.from({ length: 9 }, (_, i) => {
        const row = Math.floor(i / 3);
        const col = i % 3;
        const filled = pips.some(([r, c]) => r === row && c === col);
        return (
          <span
            key={i}
            className={`rounded-full ${filled ? 'bg-stone-900' : 'bg-transparent'}`}
          />
        );
      })}
    </span>
  );
}

export default function DicePanel({
  roll,
  currentPlayer,
  rolledBy,
  onRoll,
  onEndTurn,
  isMyTurn = true,
  hasRolled = false,
  canRoll = true,
  canEndTurn = false,
  waitingOnRobber = false,
}) {
  const total = roll?.total;

  return (
    <section
      aria-label="Dice"
      className="flex flex-col items-center gap-3 rounded-xl bg-sky-800/70 p-4"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
        {currentPlayer ? (isMyTurn ? 'Your turn' : `${currentPlayer.name}'s turn`) : 'Waiting for players'}
      </p>

      {roll ? (
        <>
          <div className="flex items-center gap-3">
            <Die value={roll.first} />
            <Die value={roll.second} />
            <span
              className={`ml-1 text-4xl font-bold tabular-nums ${
                total === 7 ? 'text-red-300' : 'text-amber-50'
              }`}
            >
              {total}
            </span>
          </div>
          {rolledBy && (
            <p className="text-xs text-sky-200">Rolled by {rolledBy.name}</p>
          )}
        </>
      ) : (
        <p className="py-3 text-sm text-sky-200">No roll yet</p>
      )}

      {isMyTurn ? (
        <>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onRoll}
              disabled={!canRoll}
              title={waitingOnRobber ? 'Resolve the robber first' : hasRolled ? 'Already rolled this turn' : undefined}
              className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold text-stone-900 shadow transition hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Roll Dice
            </button>
            {onEndTurn && (
              <button
                type="button"
                onClick={onEndTurn}
                disabled={!canEndTurn}
                title={!hasRolled ? 'You must roll before ending your turn' : undefined}
                className="rounded-lg border border-amber-100/40 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                End Turn
              </button>
            )}
          </div>
          {waitingOnRobber && <p className="text-xs text-amber-200">Move the robber, then roll.</p>}
          {!waitingOnRobber && !hasRolled && (
            <p className="text-xs text-sky-300">You may play a development card before rolling.</p>
          )}
        </>
      ) : (
        <p className="text-xs text-sky-300">Waiting for {currentPlayer?.name ?? 'the other player'}...</p>
      )}
    </section>
  );
}
