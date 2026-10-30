import { RESOURCES } from '../resources';
import { RESOURCE_STYLE, seat } from '../theme';

function canAfford(player, bundle) {
  return Object.entries(bundle ?? {}).every(([key, amount]) => (player?.resources?.[key] ?? 0) >= amount);
}

/** Static stack of resource cards for a bundle. */
function BundleCards({ bundle, emptyText }) {
  const items = RESOURCES.filter(({ key }) => (bundle?.[key] ?? 0) > 0);
  if (items.length === 0) {
    return <p className="text-sm italic text-ink-800/60">{emptyText}</p>;
  }
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {items.map(({ key, label }) => {
        const s = RESOURCE_STYLE[key];
        return (
          <div
            key={key}
            title={label}
            className={`relative flex h-16 w-12 flex-col items-center justify-between rounded-md bg-gradient-to-b p-1 shadow-lg ring-1 ring-black/30 transition-all hover:scale-110 ${s.card} ${s.ink}`}
          >
            <span className="text-lg leading-none">{s.glyph}</span>
            <span className="font-display text-[8px] font-bold uppercase tracking-wider">{label}</span>
            <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-gradient-to-b from-amber-100 to-amber-400 font-display text-[10px] font-black text-ink-900 shadow ring-1 ring-amber-700">
              {bundle[key]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Shown to each recipient of a pending offer as a sealed parchment letter with
 * exactly what the sender gives and wants, plus Accept / Reject.
 */
export default function TradeOfferModal({ offer, sender, recipient, onAccept, onReject, onCounter, disabled }) {
  const affordable = canAfford(recipient, offer.resourcesRequested);
  const s = seat(sender?.color);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trade-offer-title"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
    >
      <div className="bg-parchment relative my-auto w-full max-w-lg shrink-0 rounded-sm p-7 sm:p-9">
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-sm ring-1 ring-inset ring-amber-900/30" />

        {/* Wax seal */}
        <span
          aria-hidden="true"
          className={`absolute -top-6 left-1/2 flex size-14 -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-br ${s.gradient} font-display text-xl font-black text-parchment-50 shadow-[inset_0_3px_8px_rgba(0,0,0,0.5),0_6px_14px_rgba(0,0,0,0.6)] ring-4 ring-black/20`}
        >
          {(sender?.name ?? '?').slice(0, 1).toUpperCase()}
        </span>

        <header className="mt-4 text-center">
          <p className="font-display text-[10px] uppercase tracking-[0.5em] text-amber-900/70">A Proposal of Trade</p>
          <h2 id="trade-offer-title" className="mt-1 font-display text-2xl font-black text-ink-800">
            From {sender?.name ?? 'a player'}
          </h2>
          <p className="mt-1 text-xs italic text-ink-800/70">
            {offer.targetPlayerId ? `Addressed to ${recipient?.name}` : 'Proclaimed to all'} &middot; you answer as{' '}
            <span className="font-semibold not-italic">{recipient?.name}</span>
          </p>
          <div className="mx-auto mt-3 h-px w-40 bg-gradient-to-r from-transparent via-amber-900/60 to-transparent" />
        </header>

        <div className="mt-6 grid grid-cols-1 items-start gap-5 sm:grid-cols-[1fr_auto_1fr]">
          <div className="text-center">
            <h3 className="mb-3 font-display text-xs font-black uppercase tracking-[0.3em] text-emerald-800">You Receive</h3>
            <BundleCards bundle={offer.resourcesOffered} emptyText="nothing" />
          </div>
          <span aria-hidden="true" className="hidden self-center font-display text-3xl text-amber-900/60 sm:block">
            &#8644;
          </span>
          <div className="text-center">
            <h3 className="mb-3 font-display text-xs font-black uppercase tracking-[0.3em] text-rose-800">You Give</h3>
            <BundleCards bundle={offer.resourcesRequested} emptyText="nothing" />
          </div>
        </div>

        {!affordable && (
          <p className="mt-5 rounded border border-rose-900/40 bg-rose-100/60 px-3 py-1.5 text-center text-xs font-semibold text-rose-900">
            Your stores lack the requested goods.
          </p>
        )}

        <div className={`mt-7 grid gap-3 ${onCounter ? 'grid-cols-3 max-sm:grid-cols-2' : 'grid-cols-2'}`}>
          <button
            type="button"
            onClick={() => onReject(offer.offerId)}
            disabled={disabled}
            className="rounded-md border-2 border-ink-800/60 bg-white/30 px-3 py-2.5 font-display text-sm font-black uppercase tracking-[0.2em] text-ink-800 transition-all hover:scale-105 hover:bg-white/60 disabled:opacity-50 disabled:hover:scale-100 max-sm:text-xs"
          >
            Refuse
          </button>
          {onCounter && (
            <button
              type="button"
              onClick={onCounter}
              disabled={disabled}
              className="rounded-md border-2 border-amber-800/60 bg-gradient-to-b from-amber-100 to-amber-300 px-3 py-2.5 font-display text-sm font-black uppercase tracking-[0.2em] text-ink-900 shadow transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 max-sm:order-last max-sm:col-span-2 max-sm:text-xs"
            >
              Counter-Offer
            </button>
          )}
          <button
            type="button"
            onClick={() => onAccept(offer.offerId)}
            disabled={disabled || !affordable}
            className="rounded-md bg-gradient-to-b from-emerald-600 to-emerald-900 px-3 py-2.5 font-display text-sm font-black uppercase tracking-[0.2em] text-parchment-50 shadow-[0_6px_18px_rgba(20,105,74,0.5)] ring-1 ring-emerald-300/40 transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 max-sm:text-xs"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
