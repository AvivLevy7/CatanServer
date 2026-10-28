import { useMemo, useState } from 'react';

const RESOURCES = [
  { key: 'Lumber', label: 'Wood' },
  { key: 'Brick', label: 'Brick' },
  { key: 'Grain', label: 'Wheat' },
  { key: 'Wool', label: 'Sheep' },
  { key: 'Ore', label: 'Ore' },
];

const zeroHand = () => Object.fromEntries(RESOURCES.map(({ key }) => [key, 0]));

/**
 * Blocking modal shown after a 7 to every player who holds more than 7 cards.
 * Each owing player picks exactly half their hand (rounded down) to discard.
 * This is a hot-seat client, so we walk the owing players one at a time.
 */
export default function DiscardModal(props) {
  // Remount per player so the selection resets without an effect.
  return <DiscardForm key={props.player?.id ?? 'none'} {...props} />;
}

function DiscardForm({ player, owed, onDiscard, disabled }) {
  const [picked, setPicked] = useState(zeroHand);

  const hand = player?.resources ?? {};
  const total = useMemo(() => Object.values(picked).reduce((sum, n) => sum + n, 0), [picked]);
  const remaining = owed - total;

  const adjust = (key, delta) => {
    setPicked((prev) => {
      const next = Math.min(hand[key] ?? 0, Math.max(0, (prev[key] ?? 0) + delta));
      return { ...prev, [key]: next };
    });
  };

  if (!player) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-700/50 bg-gray-900/90 backdrop-blur-md p-6 shadow-2xl ring-1 ring-amber-700/50">
        <h2 id="discard-title" className="font-display text-xl font-bold tracking-wide text-parchment-50">
          A 7 was rolled
        </h2>
        <p className="mt-1 text-sm text-parchment-200">
          <span className="font-semibold text-amber-100">{player.name}</span>, you hold more
          than 7 cards and must discard <span className="font-bold text-amber-100">{owed}</span>.
        </p>

        <ul className="mt-4 flex flex-col gap-2">
          {RESOURCES.map(({ key, label }) => {
            const have = hand[key] ?? 0;
            const chosen = picked[key] ?? 0;
            return (
              <li
                key={key}
                className="flex items-center justify-between rounded-lg bg-gray-900/70 ring-1 ring-amber-800/40 px-3 py-2"
              >
                <span className="text-sm text-parchment-50">
                  {label} <span className="text-parchment-300/80">(have {have})</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjust(key, -1)}
                    disabled={chosen === 0}
                    aria-label={`Keep one ${label}`}
                    className="size-7 rounded-md bg-gray-800 text-parchment-50 disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="w-6 text-center text-sm font-bold tabular-nums text-parchment-50">
                    {chosen}
                  </span>
                  <button
                    type="button"
                    onClick={() => adjust(key, 1)}
                    disabled={chosen >= have || remaining <= 0}
                    aria-label={`Discard one ${label}`}
                    className="size-7 rounded-md bg-gray-800 text-parchment-50 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-parchment-200">
            {remaining > 0 ? `${remaining} more to select` : 'Ready to discard'}
          </p>
          <button
            type="button"
            onClick={() => onDiscard(picked)}
            disabled={disabled || remaining !== 0}
            className="rounded-lg bg-gradient-to-b from-amber-200 to-amber-400 px-4 py-2 font-display text-sm font-bold tracking-wide text-ink-900 shadow-lg ring-1 ring-amber-100/70 transition-all hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Discard {owed}
          </button>
        </div>
      </div>
    </div>
  );
}
