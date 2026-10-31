import { useEffect, useRef, useState } from 'react';
import { RESOURCES } from '../resources';
import { RESOURCE_STYLE } from '../theme';
import { BoatIcon } from './icons';

const DEV_META = {
  Knight: { label: 'Knight', glyph: '\u2694', face: 'from-seat-red via-rose-900 to-rose-950 ring-rose-300/50', hint: 'Move the robber and steal a card' },
  VictoryPoint: { label: 'Victory Point', glyph: '\u2605', face: 'from-amber-300 via-amber-500 to-amber-700 ring-amber-100/70 !text-ink-900', hint: '+1 VP (already counted)' },
  Monopoly: { label: 'Monopoly', glyph: '\u{1F451}', face: 'from-purple-600 via-purple-800 to-purple-950 ring-purple-300/50', hint: 'Take all of one resource from everyone' },
  YearOfPlenty: { label: 'Year of Plenty', glyph: '\u{1F33F}', face: 'from-emerald-600 via-emerald-800 to-emerald-950 ring-emerald-300/50', hint: 'Take any 2 resources from the bank' },
  RoadBuilding: { label: 'Road Building', glyph: '\u{1F6E4}', face: 'from-stone-500 via-stone-700 to-stone-900 ring-stone-300/50', hint: 'Build 2 free roads' },
};

// Compact physical-card footprint; the hand row reserves exactly this height plus the lift.
// Hover lift only on pointer devices; on touch the card is raised when tapped (data-selected).
const CARD_BASE =
  'relative flex h-16 w-12 shrink-0 select-none flex-col items-center justify-between rounded-lg border border-amber-200/60 bg-gradient-to-b p-1 text-center shadow-[0_4px_10px_rgba(0,0,0,0.6)] ring-1 transition-transform duration-200 ease-out [@media(hover:hover)]:hover:-translate-y-2 [@media(hover:hover)]:hover:z-10 [@media(hover:hover)]:hover:scale-105 data-[selected=true]:z-10 data-[selected=true]:-translate-y-2 data-[selected=true]:scale-105 data-[selected=true]:ring-2 data-[selected=true]:ring-amber-200 max-md:h-12 max-md:w-9 max-md:p-0.5';

// Development cards render a notch smaller than resources so the resource hand stays the focal point.
const DEV_SIZE = 'h-14 w-[42px] max-md:h-10 max-md:w-8';

function CardFrame({ children, className = '', ...rest }) {
  return (
    <div className={`${CARD_BASE} ${className}`} {...rest}>
      <span className="pointer-events-none absolute inset-0.5 rounded-lg border border-white/20" aria-hidden="true" />
      {children}
    </div>
  );
}

function ResourceCardFace({ resource, count, index, selected, onSelect, earmarked = false }) {
  const style = RESOURCE_STYLE[resource];
  const label = RESOURCES.find((r) => r.key === resource)?.label ?? resource;
  return (
    <CardFrame
      className={`${style.card} ${style.ink} cursor-pointer ${index > 0 ? '-ml-3 max-md:-ml-2' : ''} ${
        earmarked ? 'card-earmarked z-20 -translate-y-3 scale-105' : ''
      }`}
      style={{ zIndex: earmarked ? 20 : index }}
      title={`${count} ${label}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${count} ${label}${earmarked ? ', needed for the selected build' : ''}`}
      data-selected={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <span className="font-display text-[7px] font-bold uppercase tracking-wider opacity-90 max-md:hidden">{label}</span>
      <span className="text-xl leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.65)] max-md:text-base" aria-hidden="true">
        {style.glyph}
      </span>
      <span className="font-display text-[9px] font-black tracking-wide opacity-90">&times;{count}</span>
      {count > 1 && (
        <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full border border-amber-100 bg-ink-900 font-display text-[9px] font-black text-amber-200 shadow-lg">
          {count}
        </span>
      )}
    </CardFrame>
  );
}

function DevCardFace({ card, onPlay, disabled, index, selected, onSelect }) {
  const meta = DEV_META[card.type] ?? { label: card.type, glyph: '?', face: 'from-stone-500 to-stone-900 ring-stone-300/50', hint: '' };
  const isVp = card.type === 'VictoryPoint';
  const playable = !isVp && !disabled && card.canPlayNow;
  const title = isVp ? meta.hint : card.canPlayNow ? `${meta.hint} (tap to select, tap again to play)` : 'Playable from your next turn';

  // Two-step on every input type: the first activation raises the card, the second plays it.
  // This stops accidental plays on touch screens where there is no hover preview.
  const activate = () => {
    if (!selected) {
      onSelect();
    } else if (playable) {
      onPlay(card);
    }
  };

  return (
    <CardFrame
      className={`${meta.face} ${DEV_SIZE} text-parchment-50 ${index > 0 ? '-ml-3 max-md:-ml-2' : ''} ${playable ? 'animate-glow cursor-pointer' : 'cursor-pointer'} ${
        !playable && !isVp ? 'opacity-60 saturate-50' : ''
      }`}
      style={{ zIndex: index }}
      title={title}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-disabled={!playable}
      data-selected={selected}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      }}
    >
      <span className="font-display text-[7px] font-bold uppercase leading-tight tracking-wider max-md:hidden">{meta.label}</span>
      <span className="text-xl leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.65)] max-md:text-base" aria-hidden="true">
        {meta.glyph}
      </span>
      <span className="font-display text-[7px] font-semibold uppercase tracking-wider opacity-90">
        {isVp ? 'Scored' : selected && playable ? 'Tap to play' : card.canPlayNow ? 'Play' : 'Next turn'}
      </span>
    </CardFrame>
  );
}

function CardBack({ label, small = false }) {
  return (
    <CardFrame className={`cursor-default from-ink-800 to-ink-900 opacity-80 ring-amber-700/50 ${small ? DEV_SIZE : ''}`}>
      <span className="pointer-events-none absolute inset-2 rounded-lg border border-amber-600/30 bg-[repeating-linear-gradient(45deg,rgba(245,190,90,0.08)_0_6px,transparent_6px_12px)]" aria-hidden="true" />
      <span className="relative mb-auto mt-auto font-display text-lg font-black text-amber-400/70">C</span>
      <span className="relative font-display text-[7px] uppercase tracking-widest text-parchment-300">{label}</span>
    </CardFrame>
  );
}

/**
 * The viewer's own hand, floating at the bottom centre of the board: resources fanned on
 * the left of a gold rule, unplayed development cards on its right. Only ever receives the
 * viewer's PlayerDto - the only one the server sends with resources/developmentCards populated.
 */
export default function CardHand({
  player,
  onPlayDevCard,
  canPlay,
  deckRemaining,
  // Cost bundle to lift out of the fan while a build is being previewed.
  earmarked = null,
  // Harbour conversions are only offered on the player's own turn, after the roll.
  canTradeAtPort = false,
  onPortTrade,
}) {
  // Which card is raised; a string key so resources and dev cards share one slot.
  const [selectedKey, setSelectedKey] = useState(null);
  const toggle = (key) => setSelectedKey((current) => (current === key ? null : key));
  // Which stack's harbour bubble is open, by resource key.
  const [portPick, setPortPick] = useState(null);
  const portRef = useRef(null);

  useEffect(() => {
    if (!portPick) return undefined;
    const onPointerDown = (e) => {
      if (!portRef.current?.contains(e.target)) setPortPick(null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setPortPick(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [portPick]);

  // Rates come from the server per player: 4 by default, 3 at a generic harbour, 2 at a
  // matching one. Holding that many of a card means it can be converted right now.
  const rates = player?.bankRates ?? {};
  const resources = player?.resources ?? {};
  const devCards = (player?.developmentCards ?? []).filter((c) => !c.isPlayed);
  const total = Object.values(resources).reduce((a, b) => a + b, 0);
  const owned = RESOURCES.filter(({ key }) => (resources[key] ?? 0) > 0);

  return (
    <section
      aria-label="Your hand"
      className="panel-glass pointer-events-auto flex animate-hud-rise items-end gap-3 overflow-visible rounded-2xl px-3 py-2.5 max-md:gap-2 max-md:rounded-xl max-md:px-2 max-md:py-1.5"
    >
      {/* Resources. data-resource-hand is the landing point for the viewer's own flying
          resource icons after a roll. */}
      <div className="flex items-end" aria-label="Your resources" data-resource-hand="">
        {total === 0 && <CardBack label="Empty" />}
        {owned.map(({ key }, i) => {
          const rate = rates[key] ?? 4;
          const canConvert = canTradeAtPort && (resources[key] ?? 0) >= rate;
          return (
            <div key={key} className="relative" ref={portPick === key ? portRef : undefined}>
              <ResourceCardFace
                resource={key}
                count={resources[key]}
                index={i}
                selected={selectedKey === `res:${key}`}
                onSelect={() => toggle(`res:${key}`)}
                earmarked={(earmarked?.[key] ?? 0) > 0}
              />

              {/* Harbour badge: this stack is already big enough to convert at the
                  player's best rate for it. */}
              {canConvert && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPortPick((current) => (current === key ? null : key));
                  }}
                  title={`Trade ${rate} for any 1 resource (${rate}:1)`}
                  aria-label={`Trade ${rate} ${key} at ${rate} to 1`}
                  aria-expanded={portPick === key}
                  className={`animate-port-bob absolute -top-2.5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-black leading-none shadow-lg transition-transform hover:scale-110 ${
                    portPick === key
                      ? 'border-amber-100 bg-amber-300 text-ink-900'
                      : 'border-sky-200/80 bg-sky-700 text-sky-50'
                  }`}
                >
                  <BoatIcon className="size-3" />
                  {rate}:1
                </button>
              )}

              {/* Quick-pick: what to take in exchange. */}
              {portPick === key && (
                <div
                  role="menu"
                  aria-label={`Convert ${rate} ${key} into`}
                  className="panel-glass absolute bottom-full left-1/2 z-40 mb-3 flex -translate-x-1/2 items-center gap-1 p-1.5"
                >
                  {RESOURCES.filter((r) => r.key !== key).map((r) => {
                    const s = RESOURCE_STYLE[r.key];
                    return (
                      <button
                        key={r.key}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setPortPick(null);
                          onPortTrade?.(key, r.key);
                        }}
                        title={`Take 1 ${r.label}`}
                        aria-label={`Take 1 ${r.label}`}
                        className={`flex size-9 items-center justify-center rounded-md bg-gradient-to-b text-lg leading-none ring-1 ring-black/40 transition-transform hover:scale-110 ${s.card} ${s.ink}`}
                      >
                        <span aria-hidden="true">{s.glyph}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Gold rule between the two groups */}
      <span
        aria-hidden="true"
        className="h-14 w-px self-center bg-gradient-to-b from-transparent via-amber-400/60 to-transparent max-md:h-10"
      />

      {/* Development cards */}
      <div className="flex items-end" aria-label="Your development cards">
        {devCards.length === 0 && <CardBack small label={deckRemaining != null ? `${deckRemaining} in deck` : 'None'} />}
        {devCards.map((card, i) => (
          <DevCardFace
            key={card.id}
            card={card}
            onPlay={(c) => {
              setSelectedKey(null);
              onPlayDevCard(c);
            }}
            disabled={!canPlay}
            index={i}
            selected={selectedKey === `dev:${card.id}`}
            onSelect={() => toggle(`dev:${card.id}`)}
          />
        ))}
      </div>
    </section>
  );
}
