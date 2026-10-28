import { RESOURCES } from '../resources';
import { RESOURCE_STYLE } from '../theme';

const DEV_META = {
  Knight: { label: 'Knight', glyph: '\u2694', face: 'from-seat-red via-rose-900 to-rose-950 ring-rose-300/50', hint: 'Move the robber and steal a card' },
  VictoryPoint: { label: 'Victory Point', glyph: '\u2605', face: 'from-amber-300 via-amber-500 to-amber-700 ring-amber-100/70 !text-ink-900', hint: '+1 VP (already counted)' },
  Monopoly: { label: 'Monopoly', glyph: '\u{1F451}', face: 'from-purple-600 via-purple-800 to-purple-950 ring-purple-300/50', hint: 'Take all of one resource from everyone' },
  YearOfPlenty: { label: 'Year of Plenty', glyph: '\u{1F33F}', face: 'from-emerald-600 via-emerald-800 to-emerald-950 ring-emerald-300/50', hint: 'Take any 2 resources from the bank' },
  RoadBuilding: { label: 'Road Building', glyph: '\u{1F6E4}', face: 'from-stone-500 via-stone-700 to-stone-900 ring-stone-300/50', hint: 'Build 2 free roads' },
};

// Compact physical-card footprint; the hand row reserves exactly this height plus hover lift.
const CARD_BASE =
  'relative flex h-24 w-16 shrink-0 select-none flex-col items-center justify-between rounded-xl border-2 border-amber-200/60 bg-gradient-to-b p-1.5 text-center shadow-[0_6px_14px_rgba(0,0,0,0.6)] ring-1 transition-transform duration-200 ease-out hover:-translate-y-4 hover:z-10 hover:scale-105';

function CardFrame({ children, className = '', ...rest }) {
  return (
    <div className={`${CARD_BASE} ${className}`} {...rest}>
      <span className="pointer-events-none absolute inset-0.5 rounded-lg border border-white/20" aria-hidden="true" />
      {children}
    </div>
  );
}

function ResourceCardFace({ resource, count, index }) {
  const style = RESOURCE_STYLE[resource];
  const label = RESOURCES.find((r) => r.key === resource)?.label ?? resource;
  return (
    <CardFrame
      className={`${style.card} ${style.ink} cursor-pointer ${index > 0 ? '-ml-4' : ''}`}
      style={{ zIndex: index }}
      title={`${count} ${label}`}
      role="img"
      aria-label={`${count} ${label}`}
    >
      <span className="font-display text-[8px] font-bold uppercase tracking-wider opacity-90">{label}</span>
      <span className="text-3xl leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.65)]" aria-hidden="true">
        {style.glyph}
      </span>
      <span className="font-display text-[10px] font-black tracking-wide opacity-90">&times;{count}</span>
      {count > 1 && (
        <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border border-amber-100 bg-ink-900 font-display text-[10px] font-black text-amber-200 shadow-lg">
          {count}
        </span>
      )}
    </CardFrame>
  );
}

function DevCardFace({ card, onPlay, disabled, index }) {
  const meta = DEV_META[card.type] ?? { label: card.type, glyph: '?', face: 'from-stone-500 to-stone-900 ring-stone-300/50', hint: '' };
  const isVp = card.type === 'VictoryPoint';
  const playable = !isVp && !disabled && card.canPlayNow;
  const title = isVp ? meta.hint : card.canPlayNow ? `${meta.hint} (click to play)` : 'Playable from your next turn';

  return (
    <CardFrame
      className={`${meta.face} text-parchment-50 ${index > 0 ? '-ml-4' : ''} ${playable ? 'animate-glow cursor-pointer' : 'cursor-not-allowed'} ${
        !playable && !isVp ? 'opacity-60 saturate-50' : ''
      }`}
      style={{ zIndex: index }}
      title={title}
      role="button"
      tabIndex={playable ? 0 : -1}
      aria-disabled={!playable}
      onClick={() => playable && onPlay(card)}
      onKeyDown={(e) => {
        if (playable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onPlay(card);
        }
      }}
    >
      <span className="font-display text-[7px] font-bold uppercase leading-tight tracking-wider">{meta.label}</span>
      <span className="text-3xl leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.65)]" aria-hidden="true">
        {meta.glyph}
      </span>
      <span className="font-display text-[7px] font-semibold uppercase tracking-wider opacity-90">
        {isVp ? 'Scored' : card.canPlayNow ? 'Play' : 'Next turn'}
      </span>
    </CardFrame>
  );
}

function CardBack({ label }) {
  return (
    <CardFrame className="cursor-default from-ink-800 to-ink-900 opacity-80 ring-amber-700/50">
      <span className="pointer-events-none absolute inset-2 rounded-lg border border-amber-600/30 bg-[repeating-linear-gradient(45deg,rgba(245,190,90,0.08)_0_6px,transparent_6px_12px)]" aria-hidden="true" />
      <span className="relative mb-auto mt-auto font-display text-2xl font-black text-amber-400/70">C</span>
      <span className="relative font-display text-[7px] uppercase tracking-widest text-parchment-300">{label}</span>
    </CardFrame>
  );
}

/**
 * The viewer's own hand as two fanned groups: resources (left/centre) and unplayed
 * development cards (right), separated by a gold rule. Only ever receives the viewer's
 * PlayerDto - the only one the server sends with resources/developmentCards populated.
 */
export default function CardHand({ player, onPlayDevCard, onBuyDevCard, canBuy, canPlay, deckRemaining }) {
  const resources = player?.resources ?? {};
  const devCards = (player?.developmentCards ?? []).filter((c) => !c.isPlayed);
  const total = Object.values(resources).reduce((a, b) => a + b, 0);
  const canAfford = (resources.Ore ?? 0) >= 1 && (resources.Grain ?? 0) >= 1 && (resources.Wool ?? 0) >= 1;
  const owned = RESOURCES.filter(({ key }) => (resources[key] ?? 0) > 0);

  return (
    <section
      aria-label="Your hand"
      className="panel-glass flex items-end justify-center gap-4 overflow-visible px-4 pb-2 pt-5"
    >
      {/* Resources */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-end">
          {total === 0 && <CardBack label="Empty" />}
          {owned.map(({ key }, i) => (
            <ResourceCardFace key={key} resource={key} count={resources[key]} index={i} />
          ))}
        </div>
        <span className="font-display text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300/90">
          Resources <span className={total > 7 ? 'text-rose-300' : 'text-parchment-300/70'}>({total}{total > 7 ? ' - robber risk' : ''})</span>
        </span>
      </div>

      {/* Divider */}
      <div className="h-20 w-px self-center bg-gradient-to-b from-transparent via-amber-500/60 to-transparent" aria-hidden="true" />

      {/* Development cards */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-end">
          {devCards.length === 0 && <CardBack label="No cards" />}
          {devCards.map((card, i) => (
            <DevCardFace key={card.id} card={card} onPlay={onPlayDevCard} disabled={!canPlay} index={i} />
          ))}
        </div>
        <span className="flex items-center gap-3 font-display text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300/90">
          Development
          <button
            type="button"
            onClick={onBuyDevCard}
            disabled={!canBuy || !canAfford || deckRemaining === 0}
            title={!canBuy ? 'Roll the dice before buying' : 'Ore + Wheat + Sheep'}
            className="rounded-md bg-gradient-to-b from-amber-200 to-amber-400 px-2 py-0.5 font-display text-[10px] font-bold tracking-wide text-ink-900 shadow transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            Buy ({deckRemaining ?? '-'} left)
          </button>
        </span>
      </div>
    </section>
  );
}
