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

/** A single large die face. */
function BigDie({ value, tumbling, delay = '0ms' }) {
  const pips = PIP_LAYOUT[value] ?? [];

  return (
    <span
      role="img"
      aria-label={tumbling ? 'Rolling die' : `Die showing ${value}`}
      style={{ animationDelay: delay }}
      className={`grid size-32 grid-cols-3 grid-rows-3 gap-2 rounded-3xl bg-gradient-to-br from-parchment-50 via-parchment-100 to-parchment-300 p-4 shadow-[inset_0_-10px_18px_rgba(0,0,0,0.28),0_24px_48px_rgba(0,0,0,0.65)] ring-2 ring-amber-200/70 max-md:size-20 max-md:gap-1 max-md:rounded-2xl max-md:p-2.5 ${
        tumbling ? 'animate-dice-tumble' : 'animate-dice-land'
      }`}
    >
      {Array.from({ length: 9 }, (_, i) => {
        const row = Math.floor(i / 3);
        const col = i % 3;
        const filled = pips.some(([r, c]) => r === row && c === col);
        return (
          <span
            key={i}
            className={`rounded-full ${filled ? 'bg-ink-900 shadow-[inset_0_2px_4px_rgba(255,255,255,0.35)]' : 'bg-transparent'}`}
          />
        );
      })}
    </span>
  );
}

/** Cycles through random faces while the real result is held back. */
function useTumblingFaces(active) {
  const [faces, setFaces] = useState([1, 6]);

  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(
      () => setFaces([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]),
      70,
    );
    return () => clearInterval(id);
  }, [active]);

  return faces;
}

/**
 * Full-screen cinematic roll. The dice tumble blind, snap to the real faces, then hold
 * the total for a beat. Resource payouts are released by the hub only once this is over,
 * so nobody reads the outcome off their hand before the dice show it.
 */
export default function DiceCinematic({ cinematic, rolledByName }) {
  const tumbling = cinematic?.phase === 'tumbling';
  const tumbled = useTumblingFaces(tumbling);

  if (!cinematic) return null;

  const roll = cinematic.roll ?? null;
  const faces = tumbling || !roll ? tumbled : [roll.first, roll.second];
  const total = roll?.total ?? null;
  const isSeven = total === 7;

  return (
    <div
      role="status"
      aria-live="assertive"
      aria-label={tumbling ? 'Rolling the dice' : `Rolled ${total}`}
      className="pointer-events-none fixed inset-0 z-[45] flex animate-fade-in flex-col items-center justify-center gap-6 bg-black/55 backdrop-blur-[3px] max-md:gap-3"
    >
      <p className="font-display text-xs font-black uppercase tracking-[0.45em] text-amber-200/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] max-md:text-[10px] max-md:tracking-[0.3em]">
        {rolledByName ? `${rolledByName} rolls` : 'Rolling'}
      </p>

      <div className="flex items-center gap-8 max-md:gap-4">
        <BigDie value={faces[0]} tumbling={tumbling} />
        <BigDie value={faces[1]} tumbling={tumbling} delay="90ms" />
      </div>

      <div className="flex h-24 flex-col items-center justify-start gap-1 max-md:h-14">
        {tumbling ? (
          <span className="font-display text-5xl font-black text-parchment-300/50 max-md:text-3xl">&hellip;</span>
        ) : (
          <>
            <span
              className={`animate-total-pop font-display text-6xl font-black tabular-nums drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)] max-md:text-4xl ${
                isSeven ? 'text-rose-400' : 'text-amber-200'
              }`}
            >
              {total ?? '?'}
            </span>
            {isSeven && (
              <span className="font-display text-[11px] font-bold uppercase tracking-[0.3em] text-rose-200/90 max-md:text-[9px]">
                The robber stirs
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
