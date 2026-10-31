import { useState } from 'react';
import { RESOURCES, EMPTY_BUNDLE as EMPTY, describeBundle } from '../resources';
import { RESOURCE_STYLE, seat } from '../theme';

/**
 * A resource "card" with +/- controls. Click the card to add one, click the small
 * minus to remove one. Glows and scales on hover like a physical card being lifted.
 */
export function ResourceCard({ resource, count, max, disabled, onChange, side }) {
  const { label } = RESOURCES.find((r) => r.key === resource);
  const style = RESOURCE_STYLE[resource];
  const atMax = max != null && count >= max;
  const canAdd = !disabled && !atMax;
  const canRemove = !disabled && count > 0;
  const accent = side === 'give' ? 'ring-rose-300/70' : 'ring-emerald-300/70';

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => canAdd && onChange(count + 1)}
        disabled={!canAdd}
        title={max != null ? `${label} (you hold ${max})` : label}
        aria-label={`Add ${label}`}
        className={`group relative flex h-20 w-14 flex-col items-center justify-between rounded-lg bg-gradient-to-b p-1.5 shadow-lg ring-2 transition-all ${
          style.card
        } ${style.ink} ${
          count > 0 ? `${accent} scale-105 shadow-[0_0_18px_rgba(255,220,150,0.45)]` : 'ring-black/30'
        } ${canAdd ? 'cursor-pointer hover:-translate-y-1 hover:scale-110 hover:shadow-[0_0_22px_rgba(255,220,150,0.6)]' : 'cursor-not-allowed opacity-50'}`}
      >
        <span className="text-xl leading-none drop-shadow">{style.glyph}</span>
        <span className="font-display text-[9px] font-bold uppercase tracking-wider">{label}</span>
        {count > 0 && (
          <span className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-gradient-to-b from-amber-100 to-amber-400 font-display text-xs font-black text-ink-900 shadow ring-1 ring-amber-700">
            {count}
          </span>
        )}
        {max != null && (
          <span className="absolute -left-1.5 -top-1.5 rounded-full bg-ink-900/80 px-1 text-[9px] font-semibold text-parchment-200 ring-1 ring-amber-700/60">
            {max}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => canRemove && onChange(count - 1)}
        disabled={!canRemove}
        aria-label={`Remove ${label}`}
        className="size-5 rounded-full border border-amber-900/50 bg-parchment-50 font-display text-xs font-black leading-none text-ink-900 shadow transition-all hover:scale-110 hover:bg-white disabled:opacity-30 disabled:hover:scale-100"
      >
        &minus;
      </button>
    </div>
  );
}

function BundleColumn({ title, subtitle, bundle, setBundle, limits, lockedKeys, disabled, side }) {
  const accent = side === 'give' ? 'text-rose-800' : 'text-emerald-800';
  return (
    <div className="flex flex-col items-center">
      <h3 className={`font-display text-sm font-black uppercase tracking-[0.3em] ${accent}`}>{title}</h3>
      <p className="mb-3 text-xs italic text-ink-800/60">{subtitle}</p>
      {/*
        Six columns, each card spanning two: three sit on the top row, and nudging the
        fourth to column 2 leaves the remaining pair centred under them. Beats flex-wrap,
        which left a lone Ore hanging under the other four in the narrow grid column.
      */}
      <div className="grid w-full grid-cols-6 justify-items-center gap-y-3 [&>*]:col-span-2 [&>*:nth-child(4)]:col-start-2">
        {RESOURCES.map(({ key }) => {
          const locked = lockedKeys.has(key) && bundle[key] === 0;
          return (
            <ResourceCard
              key={key}
              resource={key}
              side={side}
              count={bundle[key]}
              max={limits?.[key]}
              disabled={disabled || locked}
              onChange={(next) => setBundle({ ...bundle, [key]: Math.max(0, next) })}
            />
          );
        })}
      </div>
    </div>
  );
}

function WaxSeal({ children, color }) {
  const s = seat(color);
  return (
    <span
      className={`inline-flex size-9 items-center justify-center rounded-full bg-gradient-to-br ${s.gradient} font-display text-xs font-black text-parchment-50 shadow-[inset_0_2px_6px_rgba(0,0,0,0.5),0_3px_8px_rgba(0,0,0,0.5)] ring-2 ring-black/30`}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

/**
 * Lets the current player assemble a player-to-player offer on a parchment decree.
 * While an offer is outstanding it shows its status and a withdraw button instead.
 */
export default function PlayerTradePanel(props) {
  // Remount the builder whenever the seat or the countered offer changes so its draft state resets.
  return <TradeBuilder key={`${props.player?.id ?? 'none'}:${props.counterTo?.offer?.offerId ?? ''}`} {...props} />;
}

function TradeBuilder({ player, opponents, activeOffer, lastResult, onPropose, onCancel, disabled, counterTo = null }) {
  // Countering flips the original: what they asked of us becomes our "give", what they offered our "get".
  const seed = counterTo?.offer;
  const [giveDraft, setGive] = useState(() => ({ ...EMPTY, ...(seed?.resourcesRequested ?? {}) }));
  const [get, setGet] = useState(() => ({ ...EMPTY, ...(seed?.resourcesOffered ?? {}) }));
  const [target, setTarget] = useState(seed?.senderPlayerId ?? '');

  const resources = player?.resources ?? {};
  const give = Object.fromEntries(
    RESOURCES.map(({ key }) => [key, Math.min(giveDraft[key] ?? 0, resources[key] ?? 0)]),
  );

  const giveKeys = new Set(RESOURCES.filter(({ key }) => give[key] > 0).map(({ key }) => key));
  const getKeys = new Set(RESOURCES.filter(({ key }) => get[key] > 0).map(({ key }) => key));
  // Asymmetric trades may be sent (a bare ask opens the haggling) - just not an empty decree.
  const isValidOffer = giveKeys.size > 0 || getKeys.size > 0;
  // ...but the rules forbid giving cards away for nothing, so the recipient can only answer
  // a one-sided decree with a counter-offer or a refusal.
  const isOneSided = isValidOffer && (giveKeys.size === 0 || getKeys.size === 0);
  const canSend = !disabled && isValidOffer && (!activeOffer || !!counterTo);

  const mine = activeOffer && activeOffer.senderPlayerId === player?.id;
  const targetName = (id) => opponents.find((o) => o.id === id)?.name ?? 'Anyone';

  return (
    <section aria-label="Player trade" className="bg-parchment relative rounded-sm p-6 sm:p-8">
      {/* Torn-edge illusion */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-sm ring-1 ring-inset ring-amber-900/30" />

      <header className="mb-5 text-center">
        <p className="font-display text-[10px] uppercase tracking-[0.5em] text-amber-900/70">
          {counterTo ? 'A Counter-Proposal' : 'A Decree of Commerce'}
        </p>
        <h2 className="font-display text-2xl font-black tracking-wide text-ink-800">
          {counterTo ? `Counter ${counterTo.senderName}'s offer` : 'Trade with Players'}
        </h2>
        {counterTo && (
          <p className="mt-1 text-xs italic text-ink-800/70">
            Their terms are filled in below - adjust them and send the decree back.
          </p>
        )}
        <div className="mx-auto mt-2 h-px w-40 bg-gradient-to-r from-transparent via-amber-900/60 to-transparent" />
      </header>

      {mine ? (
        <div className="mx-auto max-w-md rounded border border-amber-900/30 bg-white/30 p-4 text-center">
          <p className="font-display font-bold text-ink-800">Offer sent to {targetName(activeOffer.targetPlayerId)}</p>
          <p className="mt-2 text-sm">
            <span className="font-semibold text-rose-800">Give</span> {describeBundle(activeOffer.resourcesOffered)}
            <span className="mx-2 text-amber-900">&#10022;</span>
            <span className="font-semibold text-emerald-800">Get</span> {describeBundle(activeOffer.resourcesRequested)}
          </p>
          {activeOffer.declinedBy?.length > 0 && (
            <p className="mt-1 text-xs text-rose-800">Declined by {activeOffer.declinedBy.map(targetName).join(', ')}</p>
          )}
          <p className="mt-2 text-xs italic text-ink-800/60">Awaiting a reply...</p>
          <button
            type="button"
            onClick={() => onCancel(activeOffer.offerId)}
            disabled={disabled}
            className="mt-4 rounded border border-ink-800/40 bg-ink-800/90 px-4 py-1.5 font-display text-xs font-bold uppercase tracking-widest text-parchment-100 transition-all hover:scale-105 hover:bg-ink-800 disabled:opacity-50"
          >
            Withdraw offer
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[1fr_auto_1fr]">
            <BundleColumn
              title="I Offer"
              subtitle={getKeys.size === 0 && giveKeys.size > 0 ? 'an opening bid' : 'from my own stores'}
              side="give"
              bundle={give}
              setBundle={setGive}
              limits={resources}
              lockedKeys={getKeys}
              disabled={disabled}
            />
            <div className="hidden h-full flex-col items-center justify-center md:flex" aria-hidden="true">
              <span className="font-display text-4xl text-amber-900/60">&#8644;</span>
            </div>
            <BundleColumn
              title="In Return"
              subtitle={giveKeys.size === 0 && getKeys.size > 0 ? 'a plain request' : 'I ask for in return'}
              side="get"
              bundle={get}
              setBundle={setGet}
              lockedKeys={giveKeys}
              disabled={disabled}
            />
          </div>

          <div className="mt-6 flex flex-col items-center gap-3">
            <p className="font-display text-[10px] uppercase tracking-[0.3em] text-amber-900/70">Addressed to</p>
            <div className="flex flex-wrap justify-center gap-2">
              {!counterTo && (
                <button
                  type="button"
                  onClick={() => setTarget('')}
                  disabled={disabled}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 font-display text-xs font-bold transition-all hover:scale-105 ${
                    target === ''
                      ? 'border-amber-900 bg-ink-800 text-parchment-50 shadow'
                      : 'border-amber-900/40 bg-white/30 text-ink-800 hover:bg-white/60'
                  }`}
                >
                  <span className="text-base leading-none">&#9733;</span> Anyone
                </button>
              )}
              {opponents.filter((o) => !counterTo || o.id === counterTo.offer.senderPlayerId).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setTarget(o.id)}
                  disabled={disabled || !!counterTo}
                  className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 font-display text-xs font-bold transition-all hover:scale-105 ${
                    target === o.id
                      ? 'border-amber-900 bg-ink-800 text-parchment-50 shadow'
                      : 'border-amber-900/40 bg-white/30 text-ink-800 hover:bg-white/60'
                  }`}
                >
                  <WaxSeal color={o.color}>{o.name.slice(0, 1).toUpperCase()}</WaxSeal>
                  {o.name}
                </button>
              ))}
            </div>
          </div>

          {lastResult && (
            <p
              className={`mt-4 text-center text-sm font-semibold ${
                lastResult.outcome === 'Accepted' ? 'text-emerald-800' : 'text-rose-800'
              }`}
            >
              {lastResult.outcome === 'Accepted' && `Trade accepted by ${targetName(lastResult.byPlayerId)}.`}
              {lastResult.outcome === 'Rejected' && 'Your offer was declined.'}
              {lastResult.outcome === 'Cancelled' && 'Offer withdrawn.'}
            </p>
          )}

          {!isValidOffer && !disabled && (
            <p className="mt-4 text-center text-xs italic text-ink-800/60">
              Choose at least one card to offer or to ask for.
            </p>
          )}

          {isOneSided && !disabled && (
            <p className="mt-4 text-center text-xs italic text-amber-900/80">
              Only one side is filled in: this opens the haggling, but it cannot be accepted as
              written - they can only counter it or refuse.
            </p>
          )}

          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={() => onPropose(target || null, give, get)}
              disabled={!canSend}
              className="rounded-md bg-gradient-to-b from-seat-red to-rose-950 px-8 py-2.5 font-display text-sm font-black uppercase tracking-[0.25em] text-parchment-50 shadow-[0_6px_18px_rgba(139,30,45,0.5)] ring-1 ring-rose-300/40 transition-all hover:scale-105 hover:shadow-[0_8px_26px_rgba(139,30,45,0.7)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            >
              {counterTo ? 'Send Counter-Offer' : 'Seal & Send'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
