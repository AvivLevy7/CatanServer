import { RESOURCES } from '../resources';
import { RESOURCE_STYLE, seat } from '../theme';
import { CheckIcon, CounterIcon, CrossIcon } from './icons';

function canAfford(player, bundle) {
  return Object.entries(bundle ?? {}).every(([key, amount]) => (player?.resources?.[key] ?? 0) >= amount);
}

function bundleSize(bundle) {
  return RESOURCES.reduce((total, { key }) => total + (bundle?.[key] ?? 0), 0);
}

/** One row of small resource chips, or a dash when the side is empty. */
function BundleChips({ bundle }) {
  const items = RESOURCES.filter(({ key }) => (bundle?.[key] ?? 0) > 0);
  if (items.length === 0) {
    return <span className="text-xs italic text-parchment-300/60">nothing</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map(({ key, label }) => {
        const s = RESOURCE_STYLE[key];
        return (
          <span
            key={key}
            title={`${bundle[key]} ${label}`}
            className={`flex items-center gap-0.5 rounded-md bg-gradient-to-b px-1.5 py-1 text-[11px] font-black shadow ring-1 ring-black/30 ${s.card} ${s.ink}`}
          >
            <span aria-hidden="true" className="text-sm leading-none">{s.glyph}</span>
            {bundle[key]}
            <span className="sr-only">{label}</span>
          </span>
        );
      })}
    </div>
  );
}

const ACTION_BTN =
  'flex size-11 items-center justify-center rounded-xl border-2 shadow-lg transition-all hover:scale-110 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:scale-100 max-md:size-10';

/**
 * Incoming offers as a small panel pinned to the left edge rather than a modal, so the
 * board and the viewer's own hand stay in sight while they weigh the terms. Actions are
 * icon-only: refuse, counter, accept (accept is withheld on a one-sided offer, which the
 * rules allow as an opening but not as a bargain).
 */
export default function TradeOfferPanel({ offer, sender, recipient, onAccept, onReject, onCounter, disabled }) {
  const affordable = canAfford(recipient, offer.resourcesRequested);
  const oneSided = bundleSize(offer.resourcesOffered) === 0 || bundleSize(offer.resourcesRequested) === 0;
  const s = seat(sender?.color);

  const note = oneSided
    ? 'Only one side is filled in - counter it or refuse.'
    : !affordable
      ? 'Your stores lack the requested goods.'
      : null;

  return (
    <section
      aria-label={`Trade offer from ${sender?.name ?? 'a player'}`}
      className="animate-glow panel-glass pointer-events-auto fixed left-[4.75rem] top-1/2 z-[34] w-[17rem] -translate-y-1/2 p-3 max-md:left-[3.25rem] max-md:w-[14.5rem] max-md:p-2.5"
    >
      <header className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${s.gradient} font-display text-xs font-black text-parchment-50 shadow ring-2 ring-black/30`}
        >
          {(sender?.name ?? '?').slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-sm font-bold text-parchment-50">
            {sender?.name ?? 'A player'}
          </span>
          <span className="block text-[10px] uppercase tracking-[0.2em] text-amber-300/80">
            {offer.targetPlayerId ? 'Offers you' : 'Offers anyone'}
          </span>
        </span>
      </header>

      <div className="rule-gold my-2.5" aria-hidden="true" />

      <dl className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <dt className="w-14 shrink-0 whitespace-nowrap font-display text-[9px] font-bold uppercase tracking-[0.15em] text-emerald-300/90">
            You get
          </dt>
          <dd className="min-w-0 flex-1">
            <BundleChips bundle={offer.resourcesOffered} />
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="w-14 shrink-0 whitespace-nowrap font-display text-[9px] font-bold uppercase tracking-[0.15em] text-rose-300/90">
            You give
          </dt>
          <dd className="min-w-0 flex-1">
            <BundleChips bundle={offer.resourcesRequested} />
          </dd>
        </div>
      </dl>

      {note && (
        <p className="mt-2.5 rounded-md bg-amber-950/60 px-2 py-1 text-[10px] font-semibold leading-snug text-amber-100 ring-1 ring-amber-500/40">
          {note}
        </p>
      )}

      <div className="mt-3 flex items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={() => onReject(offer.offerId)}
          disabled={disabled}
          title="Refuse the offer"
          aria-label="Refuse the offer"
          className={`${ACTION_BTN} border-rose-400/60 bg-rose-900/70 text-rose-100 hover:border-rose-300 hover:bg-rose-800/80`}
        >
          <CrossIcon className="size-5" />
        </button>
        {onCounter && (
          <button
            type="button"
            onClick={onCounter}
            disabled={disabled}
            title="Counter with your own terms"
            aria-label="Counter with your own terms"
            className={`${ACTION_BTN} border-amber-300/70 bg-amber-400/90 text-ink-900 hover:border-amber-200 hover:bg-amber-300`}
          >
            <CounterIcon className="size-5" />
          </button>
        )}
        {!oneSided && (
          <button
            type="button"
            onClick={() => onAccept(offer.offerId)}
            disabled={disabled || !affordable}
            title={affordable ? 'Accept the offer' : 'You lack the requested goods'}
            aria-label="Accept the offer"
            className={`${ACTION_BTN} border-emerald-300/70 bg-emerald-700/90 text-emerald-50 hover:border-emerald-200 hover:bg-emerald-600`}
          >
            <CheckIcon className="size-5" />
          </button>
        )}
      </div>
    </section>
  );
}
