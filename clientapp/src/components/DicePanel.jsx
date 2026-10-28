import { useEffect, useState } from 'react';

// Pip positions on a 3x3 grid (row, col) for each die face.
const PIP_LAYOUT = {
  1: [[1, 1]],
  2: [[0, 2], [2, 0]],
  3: [[0, 2], [1, 1], [2, 0]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

function Die({ value, tumbling = false }) {
  const pips = PIP_LAYOUT[value] ?? [];

  return (
    <span
      className={`grid size-14 grid-cols-3 grid-rows-3 gap-0.5 rounded-lg bg-gradient-to-br from-parchment-50 to-parchment-300 p-2 shadow-[inset_0_-3px_6px_rgba(0,0,0,0.25),0_6px_12px_rgba(0,0,0,0.5)] ring-1 ring-amber-900/40 ${
        tumbling ? 'animate-bounce' : ''
      }`}
      role="img"
      aria-label={tumbling ? 'Rolling die' : `Die showing ${value}`}
    >
      {Array.from({ length: 9 }, (_, i) => {
        const row = Math.floor(i / 3);
        const col = i % 3;
        const filled = pips.some(([r, c]) => r === row && c === col);
        return (
          <span
            key={i}
            className={`rounded-full ${filled ? 'bg-ink-900 shadow-inner' : 'bg-transparent'}`}
          />
        );
      })}
    </span>
  );
}

/** Cycles through random faces every 80ms while the real result is held back. */
function TumblingDice() {
  const [faces, setFaces] = useState([1, 6]);

  useEffect(() => {
    const id = setInterval(
      () => setFaces([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]),
      80,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-3" aria-live="polite" aria-label="Rolling the dice">
      <Die value={faces[0]} tumbling />
      <Die value={faces[1]} tumbling />
      <span className="ml-1 text-4xl font-bold tabular-nums text-parchment-300/60">?</span>
    </div>
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
  isRolling = false,
}) {
  const total = roll?.total;

  return (
    <section
      aria-label="Dice"
      className="panel-glass flex flex-col items-center gap-3 p-4"
    >
      <p className="font-display text-[11px] font-bold uppercase tracking-[0.25em] text-amber-300/90">
        {currentPlayer ? (isMyTurn ? 'Your turn' : `${currentPlayer.name}'s turn`) : 'Waiting for players'}
      </p>

      {isRolling ? (
        <>
          <TumblingDice />
          <p className="text-xs text-parchment-200">Rolling...</p>
        </>
      ) : roll ? (
        <>
          <div className="flex items-center gap-3">
            <Die value={roll.first} />
            <Die value={roll.second} />
            <span
              className={`ml-1 font-display text-4xl font-black tabular-nums drop-shadow ${
                total === 7 ? 'text-rose-400' : 'text-amber-200'
              }`}
            >
              {total}
            </span>
          </div>
          {rolledBy && (
            <p className="text-xs italic text-parchment-300">Rolled by {rolledBy.name}</p>
          )}
        </>
      ) : (
        <p className="py-3 text-sm italic text-parchment-300">No roll yet</p>
      )}

      {isMyTurn ? (
        <>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onRoll}
              disabled={!canRoll || isRolling}
              title={waitingOnRobber ? 'Resolve the robber first' : hasRolled ? 'Already rolled this turn' : undefined}
              className="rounded-lg bg-gradient-to-b from-amber-200 to-amber-400 px-4 py-2 font-display text-sm font-bold tracking-wide text-ink-900 shadow-lg shadow-amber-900/40 ring-1 ring-amber-100/70 transition-all hover:scale-[1.03] hover:from-amber-100 hover:to-amber-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            >
              Roll Dice
            </button>
            {onEndTurn && (
              <button
                type="button"
                onClick={onEndTurn}
                disabled={!canEndTurn || isRolling}
                title={!hasRolled ? 'You must roll before ending your turn' : undefined}
                className="rounded-lg border border-amber-600/50 bg-gray-900/40 px-4 py-2 font-display text-sm font-semibold tracking-wide text-parchment-100 transition-all hover:scale-[1.02] hover:border-amber-400 hover:bg-gray-900/70 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              >
                End Turn
              </button>
            )}
          </div>
          {waitingOnRobber && <p className="text-xs text-amber-200">Move the robber, then roll.</p>}
          {!waitingOnRobber && !hasRolled && (
            <p className="text-xs italic text-parchment-300/80">You may play a development card before rolling.</p>
          )}
        </>
      ) : (
        <p className="text-xs italic text-parchment-300/80">Waiting for {currentPlayer?.name ?? 'the other player'}...</p>
      )}
    </section>
  );
}
