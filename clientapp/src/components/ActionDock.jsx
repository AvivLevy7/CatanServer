import { DevCardIcon, DiceIcon, EndTurnIcon, PlusIcon, TradeIcon } from './icons';

const DOCK_BTN =
  'pointer-events-auto relative flex size-12 items-center justify-center rounded-xl border text-parchment-100 shadow-xl backdrop-blur-md transition-all hover:scale-110 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:scale-100 max-md:size-10 max-md:rounded-lg';

const DOCK_IDLE = 'border-amber-700/50 bg-gray-900/85 hover:border-amber-400 hover:bg-gray-900/95';

/** Small count badge on the dev-card button (cards left in the deck). */
function Badge({ children, tone = 'gold' }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute -right-1 -top-1 min-w-4 rounded-full px-1 font-display text-[9px] font-black leading-4 shadow ring-1 ${
        tone === 'gold'
          ? 'bg-amber-300 text-ink-900 ring-amber-100/70'
          : 'bg-rose-500 text-rose-50 ring-rose-200/70'
      }`}
    >
      {children}
    </span>
  );
}

/**
 * Vertical floating dock on the right edge of the board: roll, trade, buy a development
 * card, end turn. The dice is the hero button and withdraws while the cinematic roll
 * plays, which is when the huge centre-screen dice take over.
 */
export default function ActionDock({
  onRoll,
  canRoll,
  isRolling,
  onTrade,
  canTrade,
  onBuyDev,
  canBuyDev,
  deckRemaining,
  lastTotal,
  onEndTurn,
  canEndTurn,
  hasRolled,
  isMyTurn,
  rollHint,
  tradeHint,
  buyHint,
  endTurnHint,
}) {
  return (
    <nav
      aria-label="Actions"
      className="pointer-events-none fixed right-3 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-2 max-md:right-[max(0.375rem,env(safe-area-inset-right))] max-md:gap-1.5"
    >
      {/* Roll: hidden while the big dice are on screen. */}
      <button
        type="button"
        onClick={onRoll}
        disabled={!canRoll}
        title={rollHint}
        aria-label="Roll the dice"
        className={`pointer-events-auto relative flex size-16 items-center justify-center rounded-2xl border-2 transition-all duration-300 max-md:size-13 max-md:rounded-xl ${
          isRolling
            ? 'pointer-events-none scale-50 opacity-0'
            : canRoll
              ? 'animate-glow border-amber-100/80 bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 text-ink-900 shadow-[0_0_24px_rgba(245,190,90,0.55)] hover:scale-110 active:scale-95'
              : 'border-amber-800/50 bg-gray-900/85 text-parchment-300/60 shadow-xl backdrop-blur-md'
        }`}
      >
        <DiceIcon className="size-8 max-md:size-7" />
        {lastTotal != null && !isRolling && (
          <span
            title={`Last roll: ${lastTotal}`}
            className={`absolute -bottom-1 -left-1 min-w-5 rounded-full border px-1 font-display text-[10px] font-black leading-[1.1rem] shadow-lg ${
              lastTotal === 7
                ? 'border-rose-200/70 bg-rose-600 text-rose-50'
                : 'border-amber-900/50 bg-ink-900 text-amber-200'
            }`}
          >
            {lastTotal}
          </span>
        )}
      </button>

      <span className="h-px w-8 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" aria-hidden="true" />

      <button
        type="button"
        onClick={onTrade}
        disabled={!canTrade}
        title={tradeHint}
        aria-label="Open the trade desk"
        className={`${DOCK_BTN} ${DOCK_IDLE}`}
      >
        <TradeIcon className="size-6 max-md:size-5" />
      </button>

      <button
        type="button"
        onClick={onBuyDev}
        disabled={!canBuyDev}
        title={buyHint}
        aria-label="Buy a development card"
        className={`${DOCK_BTN} ${DOCK_IDLE}`}
      >
        <DevCardIcon className="size-6 max-md:size-5" />
        <PlusIcon className="absolute bottom-1 right-1 size-3 text-amber-300" />
        {deckRemaining != null && <Badge tone={deckRemaining === 0 ? 'rose' : 'gold'}>{deckRemaining}</Badge>}
      </button>

      <button
        type="button"
        onClick={onEndTurn}
        disabled={!canEndTurn}
        title={endTurnHint}
        aria-label="End your turn"
        className={`${DOCK_BTN} ${
          canEndTurn
            ? 'border-emerald-300/70 bg-emerald-800/80 text-emerald-50 hover:border-emerald-200 hover:bg-emerald-700/90'
            : DOCK_IDLE
        }`}
      >
        <EndTurnIcon className="size-6 max-md:size-5" />
      </button>

      {/* Turn marker: a thin gold thread down the dock while the seat is live. */}
      {isMyTurn && !isRolling && (
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${hasRolled ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-300 shadow-[0_0_8px_#f5be5a]'}`}
        />
      )}
    </nav>
  );
}
