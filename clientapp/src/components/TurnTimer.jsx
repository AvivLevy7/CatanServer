import { useEffect, useState } from 'react';
import { ClockIcon } from './icons';

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
      aria-label={`${label ?? 'Turn clock'}: ${seconds} seconds left`}
      title={label ?? 'Turn clock'}
      className={`pointer-events-auto flex flex-col justify-center gap-0.5 rounded-lg border px-2 py-1 shadow-xl backdrop-blur-md transition ${
        urgent ? 'animate-pulse border-rose-400 bg-rose-950/85' : 'border-amber-700/50 bg-gray-900/85'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <ClockIcon className={`size-3.5 ${urgent ? 'text-rose-300' : 'text-amber-300/80'}`} />
        <span
          className={`font-display text-sm font-black tabular-nums leading-none ${
            urgent ? 'text-rose-200' : 'text-parchment-50'
          }`}
        >
          {String(Math.floor(seconds / 60)).padStart(1, '0')}:{String(seconds % 60).padStart(2, '0')}
        </span>
      </div>
      <div className="h-1 w-full min-w-12 overflow-hidden rounded-full bg-black/60 ring-1 ring-amber-900/40">
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
