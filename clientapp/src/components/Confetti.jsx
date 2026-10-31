import { useMemo } from 'react';

const COLORS = [
  'bg-amber-300',
  'bg-rose-400',
  'bg-emerald-400',
  'bg-sky-400',
  'bg-violet-400',
  'bg-parchment-50',
];

/**
 * Deterministic scatter in [0, 1) from a piece index and a channel number.
 *
 * Deliberately not Math.random: rendering has to be pure, so the shards are derived from
 * their own index instead. The bit mixing below is arbitrary - it only has to decorrelate
 * the channels, which it does well enough that no two pieces visibly march in step.
 */
function scatter(index, channel) {
  const x = Math.sin((index + 1) * (12.9898 + channel * 7.233) + channel * 43.123) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Falling confetti for the victory screen. CSS only - every piece is a small div on the
 * one `confetti-fall` keyframe, with its own drift, spin, speed and start time, so the
 * fall never looks like a single sheet. No canvas, no animation library, and it
 * disappears entirely under `prefers-reduced-motion` (see index.css).
 */
export default function Confetti({ pieces = 70 }) {
  const shards = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        key: i,
        left: scatter(i, 0) * 100,
        drift: (scatter(i, 1) - 0.5) * 220,
        spin: 360 + scatter(i, 2) * 1080,
        fall: 2.8 + scatter(i, 3) * 2.6,
        delay: scatter(i, 4) * 3.2,
        width: 5 + scatter(i, 5) * 6,
        height: 9 + scatter(i, 6) * 9,
        color: COLORS[i % COLORS.length],
        round: scatter(i, 7) > 0.72,
      })),
    [pieces],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {shards.map((shard) => (
        <span
          key={shard.key}
          className={`animate-confetti absolute top-0 ${shard.color} ${shard.round ? 'rounded-full' : 'rounded-[1px]'}`}
          style={{
            left: `${shard.left}%`,
            width: `${shard.width}px`,
            height: `${shard.height}px`,
            '--drift': `${shard.drift.toFixed(0)}px`,
            '--spin': `${shard.spin.toFixed(0)}deg`,
            '--fall-ms': `${shard.fall.toFixed(2)}s`,
            '--fall-delay': `${shard.delay.toFixed(2)}s`,
          }}
        />
      ))}
    </div>
  );
}
