import { RESOURCES } from '../resources';
import { RESOURCE_STYLE, seat } from '../theme';
import TradeTimerRing from './TradeTimerRing';
import TradeStatusIcon from './TradeStatusIcon';
import { tradeStatusOf } from '../tradeStatus';
import { CrossIcon } from './icons';

/** One row of small resource chips, or a dash when the side is empty. */
function BundleChips({ bundle }) {
  const items = RESOURCES.filter(({ key }) => (bundle?.[key] ?? 0) > 0);
  if (items.length === 0) {
    return <span className="text-[11px] italic text-parchment-300/60">nothing</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map(({ key, label }) => {
        const s = RESOURCE_STYLE[key];
        return (
          <span
            key={key}
            title={`${bundle[key]} ${label}`}
            className={`flex items-center gap-0.5 rounded-md bg-gradient-to-b px-1.5 py-0.5 text-[11px] font-black shadow ring-1 ring-black/30 ${s.card} ${s.ink}`}
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

/**
 * The proposer's view of their own live offer: every opponent, where they stand, and - for
 * those who said yes - a button to close the deal with that particular player.
 *
 * This is the half of the two-step flow that makes it worth having. Accepting no longer
 * executes the swap, so the player giving the cards away gets the last word on who receives
 * them, and can simply not pick the person two points from winning.
 */
export default function OfferStatusPanel({
  offer,
  players,
  myPlayerId,
  negotiators,
  onConfirm,
  onCancel,
  disabled,
}) {
  const opponents = players.filter(
    (p) => p.id !== myPlayerId && (offer.targetPlayerId == null || offer.targetPlayerId === p.id),
  );
  const rows = opponents.map((player) => ({
    player,
    status: tradeStatusOf({ playerId: player.id, offer, negotiators }),
  }));
  const ready = rows.filter((r) => r.status === 'accepted');
  const embargoed = rows.some((r) => r.status === 'embargoed');

  return (
    <TradeTimerRing
      expiresAt={offer.expiresAt}
      className="pointer-events-auto fixed left-[4.75rem] top-1/2 z-[34] w-[18rem] -translate-y-1/2 max-md:left-[3.25rem] max-md:w-[15rem]"
    >
      <section aria-label="Your trade offer" className="panel-glass w-full p-3 max-md:p-2.5">
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/80">
              Your offer
            </p>
            <p className="mt-0.5 text-[11px] text-parchment-200">
              {ready.length > 0
                ? `Pick who you trade with (${ready.length} ready)`
                : 'Waiting for an answer...'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onCancel(offer.offerId)}
            disabled={disabled}
            title="Withdraw the offer"
            aria-label="Withdraw the offer"
            className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-rose-400/50 bg-rose-900/60 text-rose-100 transition hover:border-rose-300 hover:bg-rose-800/70 disabled:opacity-40"
          >
            <CrossIcon className="size-4" />
          </button>
        </header>

        <div className="rule-gold my-2" aria-hidden="true" />

        <dl className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <dt className="w-14 shrink-0 font-display text-[9px] font-bold uppercase tracking-[0.15em] text-rose-300/90">
              You give
            </dt>
            <dd className="min-w-0 flex-1">
              <BundleChips bundle={offer.resourcesOffered} />
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="w-14 shrink-0 font-display text-[9px] font-bold uppercase tracking-[0.15em] text-emerald-300/90">
              You get
            </dt>
            <dd className="min-w-0 flex-1">
              <BundleChips bundle={offer.resourcesRequested} />
            </dd>
          </div>
        </dl>

        <ul className="mt-3 flex flex-col gap-1" aria-label="Who has answered">
          {rows.map(({ player, status }) => {
            const s = seat(player.color);
            const canClose = status === 'accepted';
            const Row = canClose ? 'button' : 'div';

            return (
              <li key={player.id}>
                <Row
                  {...(canClose
                    ? {
                        type: 'button',
                        onClick: () => onConfirm(offer.offerId, player.id),
                        disabled,
                        title: `Trade with ${player.name}`,
                        'aria-label': `Trade with ${player.name}`,
                      }
                    : {})}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition ${
                    canClose
                      ? 'animate-partner-ready cursor-pointer bg-emerald-900/40 ring-1 ring-emerald-400/60 hover:bg-emerald-800/60 disabled:opacity-50'
                      : 'bg-black/25 ring-1 ring-amber-900/30'
                  }`}
                >
                  <span aria-hidden="true" className={`inline-block size-2.5 shrink-0 rounded-full ${s.dot}`} />
                  <span className="min-w-0 flex-1 truncate font-display text-xs font-bold text-parchment-50">
                    {player.name}
                  </span>
                  <TradeStatusIcon status={status} playerName={player.name} />
                </Row>
              </li>
            );
          })}
        </ul>

        {embargoed && (
          <p className="mt-2 rounded-md bg-amber-950/60 px-2 py-1 text-[10px] font-semibold leading-snug text-amber-100 ring-1 ring-amber-500/40">
            Some players are refusing to trade with the leader. Better terms will not change
            their minds.
          </p>
        )}
      </section>
    </TradeTimerRing>
  );
}
