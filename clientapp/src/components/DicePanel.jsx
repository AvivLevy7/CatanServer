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

export default function DicePanel({ roll, currentPlayer, rolledBy, onRoll, disabled }) {
  const total = roll?.total;

  return (
    <section
      aria-label="Dice"
      className="flex flex-col items-center gap-3 rounded-xl bg-sky-800/70 p-4"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
        {currentPlayer ? `${currentPlayer.name}'s turn` : 'Waiting for players'}
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

      <button
        type="button"
        onClick={onRoll}
        disabled={disabled}
        className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold text-stone-900 shadow transition hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Roll Dice{currentPlayer ? ` (${currentPlayer.name})` : ''}
      </button>
    </section>
  );
}
