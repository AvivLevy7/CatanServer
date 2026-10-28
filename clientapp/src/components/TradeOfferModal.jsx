import { describeBundle } from './PlayerTradePanel';

const PLAYER_DOT = {
  Red: 'bg-red-500',
  Blue: 'bg-blue-500',
  Orange: 'bg-orange-500',
  White: 'bg-stone-100',
};

function canAfford(player, bundle) {
  return Object.entries(bundle ?? {}).every(([key, amount]) => (player?.resources?.[key] ?? 0) >= amount);
}

/**
 * Shown to each recipient of a pending offer (hot-seat: one at a time). Lists
 * exactly what the sender gives and wants, with Accept / Reject.
 */
export default function TradeOfferModal({ offer, sender, recipient, onAccept, onReject, disabled }) {
  const affordable = canAfford(recipient, offer.resourcesRequested);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trade-offer-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-sm rounded-2xl bg-sky-900 p-5 shadow-2xl ring-1 ring-sky-700">
        <h2 id="trade-offer-title" className="flex items-center gap-2 text-base font-bold text-amber-50">
          <span className={`inline-block size-3 rounded-full ${PLAYER_DOT[sender?.color] ?? 'bg-stone-400'}`} />
          {sender?.name ?? 'A player'} offers a trade
        </h2>
        <p className="mt-1 text-xs text-sky-300">
          {offer.targetPlayerId ? `Addressed to ${recipient?.name}` : 'Open to anyone'} &middot; responding as{' '}
          <span className="font-semibold text-amber-50">{recipient?.name}</span>
        </p>

        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="font-semibold text-emerald-300">You receive</dt>
          <dd className="text-amber-50">{describeBundle(offer.resourcesOffered)}</dd>
          <dt className="font-semibold text-rose-300">You give</dt>
          <dd className="text-amber-50">{describeBundle(offer.resourcesRequested)}</dd>
        </dl>

        {!affordable && (
          <p className="mt-3 rounded bg-rose-900/50 px-2 py-1 text-xs text-rose-200">
            You do not have the requested resources.
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onReject(offer.offerId)}
            disabled={disabled}
            className="rounded-lg border border-amber-100/40 px-3 py-2 text-sm font-semibold text-amber-50 hover:bg-sky-800 disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => onAccept(offer.offerId)}
            disabled={disabled || !affordable}
            className="rounded-lg bg-emerald-400 px-3 py-2 text-sm font-semibold text-stone-900 shadow hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
