import { useEffect, useState } from 'react';
import { ClockIcon } from './icons';

const WARN_SECONDS = 10;

/**
 * Live countdown to the server's turn deadline. Purely cosmetic: the server enforces the
 * timeout itself, this just keeps players informed.
 *
 * `total` is the full length of whatever clock is currently running, which the server
 * publishes - a turn, the shorter discard window after a 7, or the ten-second reprieve
 * granted mid-negotiation - so the bar always drains from full however short it is.
 * `extended` marks that reprieve, because a clock that visibly stops falling needs to say
 * why.
 */
export default function TurnTimer({ deadline, total = 60, label, extended = false }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);

  if (!deadline) return null;

  const remainingMs = Math.max(0, new Date(deadline).getTime() - now);
  const seconds = Math.ceil(remainingMs / 1000);
  const span = Math.max(1, total);
  const fraction = Math.min(1, remainingMs / (span * 1000));
  const urgent = seconds <= WARN_SECONDS && !extended;

  return (
    <div
      role="timer"
      aria-live={urgent ? 'assertive' : 'off'}
      aria-label={`${label ?? 'Turn clock'}: ${seconds} seconds left`}
      title={label ?? 'Turn clock'}
      className={`pointer-events-auto relative flex flex-col justify-center gap-0.5 rounded-lg border px-2 py-1 shadow-xl backdrop-blur-md transition ${
        urgent
          ? 'animate-pulse border-rose-400 bg-rose-950/85'
          : extended
            ? 'border-emerald-400/80 bg-emerald-950/85'
            : 'border-amber-700/50 bg-gray-900/85'
      }`}
    >
      {/* A negotiation bought this clock more time: say so, or a timer that stops
          falling just looks broken. */}
      {extended && (
        <span
          className="absolute -right-1 -top-2 rounded-full border border-emerald-300/80 bg-emerald-600 px-1 font-display text-[9px] font-black leading-tight text-emerald-50 shadow"
          title="Extra time while a trade is on the table"
        >
          +{Math.round(total)}s
        </span>
      )}
      <div className="flex items-center gap-1.5">
        <ClockIcon
          className={`size-3.5 ${urgent ? 'text-rose-300' : extended ? 'text-emerald-300' : 'text-amber-300/80'}`}
        />
        <span
          className={`font-display text-sm font-black tabular-nums leading-none ${
            urgent ? 'text-rose-200' : extended ? 'text-emerald-100' : 'text-parchment-50'
          }`}
        >
          {String(Math.floor(seconds / 60)).padStart(1, '0')}:{String(seconds % 60).padStart(2, '0')}
        </span>
      </div>
      <div className="h-1 w-full min-w-12 overflow-hidden rounded-full bg-black/60 ring-1 ring-amber-900/40">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${
            urgent ? 'bg-rose-400' : extended ? 'bg-emerald-300' : fraction < 0.5 ? 'bg-amber-300' : 'bg-emerald-400'
          }`}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
    </div>
  );
}
