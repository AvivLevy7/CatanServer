import { useEffect, useState } from 'react';

const WARN_SECONDS = 10;

/**
 * Live countdown to the server's turn deadline. Purely cosmetic: the server enforces
 * the timeout itself, this just keeps players informed.
 */
export default function TurnTimer({ deadline, total = 60, label }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);

  if (!deadline) return null;

  const remainingMs = Math.max(0, new Date(deadline).getTime() - now);
  const seconds = Math.ceil(remainingMs / 1000);
  const fraction = Math.min(1, remainingMs / (total * 1000));
  const urgent = seconds <= WARN_SECONDS;

  return (
    <div
      role="timer"
      aria-live={urgent ? 'assertive' : 'off'}
      aria-label={`${seconds} seconds left`}
      className={`flex min-w-[6.5rem] flex-col justify-center gap-0.5 rounded-xl border px-2 py-1 shadow-2xl backdrop-blur-md transition ${
        urgent ? 'animate-pulse border-rose-400 bg-rose-950/80' : 'border-amber-700/50 bg-gray-900/80'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-[9px] font-bold uppercase tracking-[0.2em] text-amber-300/80">{label ?? 'Turn clock'}</span>
        <span
          className={`font-display text-base font-black tabular-nums leading-none ${
            urgent ? 'text-rose-200' : 'text-parchment-50'
          }`}
        >
          {String(Math.floor(seconds / 60)).padStart(1, '0')}:{String(seconds % 60).padStart(2, '0')}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-black/60 ring-1 ring-amber-900/40">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${
            urgent ? 'bg-rose-400' : fraction < 0.5 ? 'bg-amber-300' : 'bg-emerald-400'
          }`}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
    </div>
  );
}
