import { seat, RESOURCE_STYLE } from '../theme';
import { RESOURCES } from '../resources';
import TradeStatusIcon from './TradeStatusIcon';
import {
  CrownIcon,
  DevCardIcon,
  DiscardIcon,
  FaceDownCardsIcon,
  KnightIcon,
  LaurelIcon,
  RoadIcon,
  ScalesIcon,
  ShieldIcon,
  UnplugIcon,
} from './icons';

const TONES = {
  gold: 'bg-amber-400/15 text-amber-200 ring-amber-300/40',
  crimson: 'bg-rose-500/20 text-rose-200 ring-rose-300/50',
  emerald: 'bg-emerald-500/20 text-emerald-200 ring-emerald-300/50',
  slate: 'bg-black/35 text-parchment-200 ring-amber-900/40',
  violet: 'bg-violet-500/20 text-violet-200 ring-violet-300/40',
  danger: 'bg-rose-600/25 text-rose-100 ring-rose-400/60',
};

const NEGOTIATION_LABEL = {
  Inspecting: 'is weighing the offer',
  Countering: 'is drafting a counter-offer',
};

/**
 * One icon + count pill. `title` carries the meaning that used to be printed as a text
 * label, so the HUD stays wordless without losing it for screen readers or hover.
 */
function Stat({ icon: Glyph, value, suffix, title, tone = 'slate', className = '' }) {
  return (
    <span
      title={title}
      aria-label={`${title}: ${value}`}
      className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 font-display text-[11px] font-black tabular-nums ring-1 max-md:gap-0.5 max-md:px-1 max-md:text-[10px] ${TONES[tone]} ${className}`}
    >
      <Glyph className="size-3.5 shrink-0 max-md:size-3" />
      {value}
      {suffix}
    </span>
  );
}

/**
 * Longest Road / Largest Army. These are the only two badges that come and go during a
 * game, so they are a trophy in a laurel with a lit border while held - and simply absent
 * otherwise, rather than a greyed-out slot nobody can read.
 */
function TrophyBadge({ icon: Glyph, label, value, tone }) {
  const palette =
    tone === 'crimson'
      ? 'border-rose-300/80 bg-gradient-to-b from-rose-500/35 to-rose-900/60 text-rose-50 shadow-[0_0_14px_rgba(251,113,133,0.55)]'
      : 'border-emerald-300/80 bg-gradient-to-b from-emerald-500/35 to-emerald-900/60 text-emerald-50 shadow-[0_0_14px_rgba(52,211,153,0.5)]';

  return (
    <span
      title={`${label} (+2 VP)`}
      aria-label={`${label}, +2 victory points`}
      className={`animate-trophy-shine relative flex items-center gap-0.5 rounded-md border px-1 py-0.5 font-display text-[10px] font-black tabular-nums max-md:text-[9px] ${palette}`}
    >
      <LaurelIcon className="absolute inset-0 m-auto size-full opacity-30" />
      <Glyph className="relative size-3 shrink-0" />
      <span className="relative">{value}</span>
    </span>
  );
}

function PlayerChip({
  player,
  isCurrentTurn,
  isMe,
  hasLargestArmy,
  hasLongestRoad,
  owedDiscard,
  negotiating,
  wishlist,
  tradeStatus,
  isConnected,
}) {
  const s = seat(player.color);
  const resourceCount =
    player.resourceCardCount ?? RESOURCES.reduce((sum, { key }) => sum + (player.resources?.[key] ?? 0), 0);
  const devCardCount =
    player.unplayedDevCardCount ?? (player.developmentCards ?? []).filter((c) => !c.isPlayed).length;
  const playedDevCards = player.playedDevCardCount ?? 0;
  const atRiskOnSeven = resourceCount > 7;
  // Bots never hold a socket, so "away" only means anything for a human seat.
  const isAway = isConnected === false;

  return (
    // The outer item is only a positioning context: badges and the speech bubble must be
    // free to overflow the chip, which clips itself for the heraldic band.
    <li aria-current={isCurrentTurn ? 'true' : undefined} className="relative shrink-0">
      <div
        data-player-id={player.id}
        className={`panel-glass pointer-events-auto relative flex flex-col gap-1 overflow-hidden rounded-xl py-1.5 pl-3 pr-2 transition-all max-md:gap-0.5 max-md:rounded-lg max-md:py-1 max-md:pl-2 max-md:pr-1.5 ${
          isCurrentTurn
            ? `animate-turn-glow ring-2 ${s.ring}`
            : isAway
              ? 'opacity-55 saturate-50 hover:opacity-90'
              : 'opacity-85 hover:opacity-100'
        }`}
      >
        {/* Heraldic colour band */}
        <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${s.gradient}`} />
        {/* Active seat: a bright seam along the top of the card. */}
        {isCurrentTurn && (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-200 to-transparent"
          />
        )}

        {/* ---- Line 1: who, and what they hold ---- */}
        <div className="flex items-center gap-1.5 max-md:gap-1">
          {isCurrentTurn ? (
            <CrownIcon className="size-3.5 shrink-0 text-amber-300 drop-shadow-[0_0_6px_rgba(245,190,90,0.8)] max-md:size-3" />
          ) : (
            <span className={`inline-block size-2.5 shrink-0 rounded-full ring-1 ring-black/40 ${s.dot}`} />
          )}

          <span
            className={`max-w-[7rem] truncate font-display text-xs font-bold tracking-wide max-md:max-w-[4.5rem] max-md:text-[10px] ${
              isMe ? 'text-amber-100' : 'text-parchment-50'
            }`}
            title={isMe ? `${player.name} (you)` : player.name}
          >
            {player.name}
          </span>

          {isAway && (
            <span
              role="status"
              title={`${player.name} has lost connection`}
              aria-label={`${player.name} has lost connection`}
              className="flex shrink-0 items-center text-rose-300"
            >
              <UnplugIcon className="size-3.5 animate-pulse max-md:size-3" />
            </span>
          )}

          <span className="ml-auto flex shrink-0 items-center gap-1 max-md:gap-0.5">
            {hasLargestArmy && (
              <TrophyBadge
                icon={KnightIcon}
                label="Largest Army"
                value={player.knightsPlayed ?? 0}
                tone="crimson"
              />
            )}
            {hasLongestRoad && (
              <TrophyBadge
                icon={RoadIcon}
                label="Longest Road"
                value={player.longestRoadLength ?? 0}
                tone="emerald"
              />
            )}

            {/* Standing "wanted / for sale" notice, so the active player can see who to
                approach without opening anything. */}
            {wishlist && (wishlist.wants || wishlist.offers) && (
              <span
                className="animate-wish-pop flex items-center gap-px rounded-md bg-black/40 px-1 py-0.5 ring-1 ring-amber-700/50"
                title={`Wants ${wishlist.wants ?? 'nothing'} - offers ${wishlist.offers ?? 'nothing'}`}
                aria-label={`${player.name} wants ${wishlist.wants ?? 'nothing'} and offers ${wishlist.offers ?? 'nothing'}`}
              >
                {wishlist.wants && (
                  <span className="text-[11px] leading-none" aria-hidden="true">
                    {'↓'}
                    {RESOURCE_STYLE[wishlist.wants]?.glyph}
                  </span>
                )}
                {wishlist.offers && (
                  <span className="text-[11px] leading-none" aria-hidden="true">
                    {'↑'}
                    {RESOURCE_STYLE[wishlist.offers]?.glyph}
                  </span>
                )}
              </span>
            )}
          </span>
        </div>

        {/* ---- Line 2: the scoreboard ---- */}
        <div className="flex items-center gap-1 max-md:gap-0.5">
          <Stat
            icon={ShieldIcon}
            value={player.victoryPoints}
            title="Victory points"
            tone="gold"
            className={isCurrentTurn ? 'animate-glow' : ''}
          />
          <Stat
            icon={FaceDownCardsIcon}
            value={resourceCount}
            title={atRiskOnSeven ? 'Resource cards: discards on a 7' : 'Resource cards in hand'}
            tone={atRiskOnSeven ? 'danger' : 'slate'}
          />
          <Stat
            icon={DevCardIcon}
            value={devCardCount}
            suffix={playedDevCards > 0 ? <span className="text-violet-300/70">/{playedDevCards}</span> : null}
            title={
              playedDevCards > 0
                ? `Development cards: ${devCardCount} in hand, ${playedDevCards} played`
                : 'Development cards in hand'
            }
            tone="violet"
          />
          {!hasLargestArmy && (
            <Stat
              icon={KnightIcon}
              value={player.knightsPlayed ?? 0}
              title="Knights played"
              tone="slate"
              className="max-md:hidden"
            />
          )}
          {!hasLongestRoad && (
            <Stat
              icon={RoadIcon}
              value={player.longestRoadLength ?? 0}
              title="Longest road"
              tone="slate"
              className="max-md:hidden"
            />
          )}
        </div>
      </div>

      {/* Owes a discard after a 7: flashes until they have paid up, so the whole table
          can see who the game is waiting on. */}
      {owedDiscard > 0 && (
        <span
          role="status"
          title={`${player.name} must discard ${owedDiscard} card${owedDiscard === 1 ? '' : 's'}`}
          aria-label={`${player.name} must discard ${owedDiscard} cards`}
          className="animate-discard-flash pointer-events-none absolute -right-1 -top-1 z-10 flex items-center gap-0.5 rounded-full border border-rose-200 bg-rose-600 px-1.5 py-0.5 font-display text-[10px] font-black leading-none text-rose-50"
        >
          <DiscardIcon className="size-3" />
          {owedDiscard}
        </span>
      )}

      {/* Where this seat stands on the live offer. The settled answer (accepted, declined,
          embargoed) wins over the softer "still reading" hint, and the scales are the
          fallback for a seat deliberating with no offer of its own on the table. */}
      {tradeStatus && tradeStatus !== 'idle' && tradeStatus !== 'waiting' ? (
        <span className="pointer-events-none absolute -bottom-1 -right-1 z-10">
          <TradeStatusIcon status={tradeStatus} playerName={player.name} className="size-5 shadow-lg" />
        </span>
      ) : (
        negotiating && (
          <span
            role="status"
            title={`${player.name} ${NEGOTIATION_LABEL[negotiating] ?? 'is considering the offer'}`}
            aria-label={`${player.name} ${NEGOTIATION_LABEL[negotiating] ?? 'is considering the offer'}`}
            className="pointer-events-none absolute -bottom-1 -right-1 z-10 flex size-5 items-center justify-center rounded-full border border-amber-200/80 bg-amber-400 text-ink-900 shadow-lg"
          >
            <ScalesIcon className="animate-scales size-3.5" />
          </span>
        )
      )}
    </li>
  );
}

/** Row of heraldic seat cards that floats over the top edge of the board. */
export default function PlayerStatusBar({
  players,
  currentTurnPlayerId,
  myPlayerId,
  largestArmyHolderId,
  longestRoadHolderId,
  pendingDiscards = {},
  negotiators = {},
  wishlists = {},
  tradeStatuses = {},
  connections = {},
}) {
  return (
    <ul
      aria-label="Players"
      className="pointer-events-none flex min-w-0 max-w-full flex-nowrap items-stretch justify-center gap-1.5 overflow-x-auto overflow-y-hidden p-1.5 max-md:gap-1"
    >
      {players.map((player) => (
        <PlayerChip
          key={player.id}
          player={player}
          isCurrentTurn={player.id === currentTurnPlayerId}
          isMe={player.id === myPlayerId}
          hasLargestArmy={player.id === largestArmyHolderId}
          hasLongestRoad={player.id === longestRoadHolderId}
          owedDiscard={pendingDiscards[player.id] ?? 0}
          negotiating={negotiators[player.id] ?? null}
          wishlist={wishlists[player.id] ?? null}
          tradeStatus={tradeStatuses[player.id] ?? null}
          isConnected={connections[player.id]}
        />
      ))}
    </ul>
  );
}
