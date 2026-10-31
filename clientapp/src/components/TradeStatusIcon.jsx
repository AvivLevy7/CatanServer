import { TRADE_STATUS_LABELS as LABELS } from '../tradeStatus';
import { CheckIcon, CrossIcon, CounterIcon, LockIcon } from './icons';

/** Three dots breathing in sequence: "still thinking". */
function ThinkingDots({ className = '' }) {
  return (
    <span className={`flex items-center gap-[3px] ${className}`} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="animate-status-dot block size-1.5 rounded-full bg-current"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}

/**
 * The status badge itself. `status` comes from `tradeStatusOf` in ../tradeStatus.
 */
export default function TradeStatusIcon({ status, playerName, className = '' }) {
  const label = `${playerName ?? 'Player'}: ${LABELS[status] ?? LABELS.idle}`;
  const common = `flex size-6 shrink-0 items-center justify-center rounded-full ring-1 ${className}`;

  switch (status) {
    case 'accepted':
      return (
        <span title={label} aria-label={label} role="img" className={`animate-status-in ${common} bg-emerald-500/90 text-emerald-50 ring-emerald-200/70`}>
          <CheckIcon className="size-3.5" />
        </span>
      );
    case 'embargoed':
      return (
        <span title={label} aria-label={label} role="img" className={`animate-status-in ${common} bg-amber-700/80 text-amber-100 ring-amber-300/60`}>
          <LockIcon className="size-3.5" />
        </span>
      );
    case 'declined':
      return (
        <span title={label} aria-label={label} role="img" className={`animate-status-in ${common} bg-rose-600/85 text-rose-50 ring-rose-200/70`}>
          <CrossIcon className="size-3.5" />
        </span>
      );
    case 'countering':
      return (
        <span title={label} aria-label={label} role="img" className={`${common} bg-sky-600/85 text-sky-50 ring-sky-200/70`}>
          <CounterIcon className="size-3.5" />
        </span>
      );
    case 'reviewing':
      return (
        <span title={label} aria-label={label} role="img" className={`${common} bg-black/40 text-amber-200 ring-amber-700/50`}>
          <ThinkingDots />
        </span>
      );
    default:
      return (
        <span title={label} aria-label={label} role="img" className={`${common} bg-black/30 text-parchment-300/50 ring-amber-900/40`}>
          <span className="block size-1.5 rounded-full bg-current" aria-hidden="true" />
        </span>
      );
  }
}
