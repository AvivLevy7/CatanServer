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

function Die({ value, tumbling = false, armed = false }) {
  const pips = PIP_LAYOUT[value] ?? [];

  return (
    <span
      className={`grid size-16 grid-cols-3 grid-rows-3 gap-1 rounded-xl bg-gradient-to-br from-parchment-50 to-parchment-300 p-2.5 shadow-[inset_0_-4px_8px_rgba(0,0,0,0.25),0_8px_16px_rgba(0,0,0,0.5)] ring-1 ring-amber-900/40 transition-transform max-md:size-12 max-md:gap-0.5 max-md:p-2 ${
        tumbling ? 'animate-bounce' : ''
      } ${armed ? 'animate-glow ring-2 ring-amber-200' : ''}`}
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
function useTumblingFaces(active) {
  const [faces, setFaces] = useState([1, 6]);

  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(
      () => setFaces([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]),
      80,
    );
    return () => clearInterval(id);
  }, [active]);

  return faces;
}

/**
 * The dice ARE the roll button: when it is the viewer's turn and a roll is due, the pair
 * glows and a tap/click rolls them. Otherwise they simply show the last result.
 */
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
  const tumbling = useTumblingFaces(isRolling);
  const armed = isMyTurn && canRoll && !isRolling;
  const faces = isRolling ? tumbling : roll ? [roll.first, roll.second] : [3, 4];

  const hint = isRolling
    ? 'Rolling...'
    : armed
      ? 'Tap the dice to roll'
      : waitingOnRobber && isMyTurn
        ? 'Move the robber, then roll.'
        : roll && rolledBy
          ? `Rolled by ${rolledBy.name}`
          : isMyTurn
            ? 'You may play a development card before rolling.'
            : `Waiting for ${currentPlayer?.name ?? 'the other player'}...`;

  return (
    <section
      aria-label="Dice"
      className="panel-glass flex flex-col items-center gap-1.5 p-2 max-md:gap-1 max-md:p-1.5"
    >
      <p className="font-display text-[11px] font-bold uppercase tracking-[0.25em] text-amber-300/90 max-md:text-[9px]">
        {currentPlayer ? (isMyTurn ? 'Your turn' : `${currentPlayer.name}'s turn`) : 'Waiting for players'}
      </p>

      <button
        type="button"
        onClick={() => armed && onRoll()}
        disabled={!armed}
        title={armed ? 'Roll the dice' : hasRolled ? 'Already rolled this turn' : undefined}
        aria-label={armed ? 'Roll the dice' : isRolling ? 'Rolling the dice' : `Dice showing ${total ?? 'nothing yet'}`}
        aria-live="polite"
        className={`flex items-center gap-3 rounded-2xl p-2 transition-all max-md:gap-2 max-md:p-1 ${
          armed
            ? 'cursor-pointer hover:scale-105 active:scale-95'
            : 'cursor-default'
        } ${!roll && !isRolling && !armed ? 'opacity-50' : ''}`}
      >
        <Die value={faces[0]} tumbling={isRolling} armed={armed} />
        <Die value={faces[1]} tumbling={isRolling} armed={armed} />
        <span
          className={`ml-1 w-10 text-center font-display text-3xl font-black tabular-nums drop-shadow max-md:w-7 max-md:text-xl ${
            isRolling || !roll ? 'text-parchment-300/60' : total === 7 ? 'text-rose-400' : 'text-amber-200'
          }`}
        >
          {isRolling || !roll ? '?' : total}
        </span>
      </button>

      <p className={`text-center text-xs italic max-md:text-[10px] ${armed ? 'text-amber-200 not-italic font-semibold' : 'text-parchment-300/80'}`}>
        {hint}
      </p>

      {isMyTurn && onEndTurn && (
        <button
          type="button"
          onClick={onEndTurn}
          disabled={!canEndTurn || isRolling}
          title={!hasRolled ? 'You must roll before ending your turn' : undefined}
          className="rounded-md border border-amber-600/50 bg-gray-900/40 px-3 py-1 font-display text-xs font-semibold tracking-wide text-parchment-100 transition-all hover:border-amber-400 hover:bg-gray-900/70 disabled:cursor-not-allowed disabled:opacity-40 max-md:px-2 max-md:py-0.5 max-md:text-[10px]"
        >
          End Turn
        </button>
      )}
    </section>
  );
}
