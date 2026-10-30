import { seat } from '../theme';
import { RESOURCES } from '../resources';
import { CardsIcon, CrownIcon, DevCardIcon, KnightIcon, RoadIcon, StarIcon } from './icons';

const TONES = {
  gold: 'bg-amber-400/15 text-amber-200 ring-amber-300/40',
  crimson: 'bg-rose-500/20 text-rose-200 ring-rose-300/50',
  emerald: 'bg-emerald-500/20 text-emerald-200 ring-emerald-300/50',
  slate: 'bg-black/35 text-parchment-200 ring-amber-900/40',
  violet: 'bg-violet-500/20 text-violet-200 ring-violet-300/40',
  danger: 'bg-rose-600/25 text-rose-100 ring-rose-400/60',
};

/**
 * One icon + count pill. `title` carries the meaning that used to be printed as a text
 * label, so the HUD stays wordless without losing it for screen readers or hover.
 */
function Stat({ icon: Glyph, value, title, tone = 'slate', lit = false }) {
  return (
    <span
      title={title}
      aria-label={`${title}: ${value}`}
      className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 font-display text-[11px] font-black tabular-nums ring-1 max-md:gap-0.5 max-md:px-1 max-md:text-[10px] ${TONES[tone]} ${
        lit ? 'animate-glow' : ''
      }`}
    >
      <Glyph className="size-3.5 shrink-0 max-md:size-3" />
      {value}
    </span>
  );
}

function PlayerChip({ player, isCurrentTurn, isMe, hasLargestArmy, hasLongestRoad }) {
  const s = seat(player.color);
  const resourceCount =
    player.resourceCardCount ?? RESOURCES.reduce((sum, { key }) => sum + (player.resources?.[key] ?? 0), 0);
  const devCardCount =
    player.unplayedDevCardCount ?? (player.developmentCards ?? []).filter((c) => !c.isPlayed).length;
  const atRiskOnSeven = resourceCount > 7;

  return (
    <li
      aria-current={isCurrentTurn ? 'true' : undefined}
      className={`panel-glass pointer-events-auto relative flex shrink-0 items-center gap-2 overflow-hidden rounded-xl py-1 pl-3 pr-2 transition-all max-md:gap-1 max-md:rounded-lg max-md:py-0.5 max-md:pl-2 max-md:pr-1.5 ${
        isCurrentTurn
          ? `ring-2 ${s.ring} shadow-[0_0_26px_rgba(245,190,90,0.3)]`
          : 'opacity-80 hover:opacity-100'
      }`}
    >
      {/* Heraldic colour band */}
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${s.gradient}`} />

      <div className="flex min-w-0 items-center gap-1.5 max-md:gap-1">
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
      </div>

      <div className="flex items-center gap-1 max-md:gap-0.5">
        <Stat
          icon={StarIcon}
          value={player.victoryPoints}
          title="Victory points"
          tone="gold"
          lit={isCurrentTurn}
        />
        <Stat
          icon={KnightIcon}
          value={player.knightsPlayed ?? 0}
          title={hasLargestArmy ? 'Largest Army (+2 VP)' : 'Knights played'}
          tone={hasLargestArmy ? 'crimson' : 'slate'}
          lit={hasLargestArmy}
        />
        <Stat
          icon={RoadIcon}
          value={player.longestRoadLength ?? 0}
          title={hasLongestRoad ? 'Longest Road (+2 VP)' : 'Longest road'}
          tone={hasLongestRoad ? 'emerald' : 'slate'}
          lit={hasLongestRoad}
        />
        <Stat
          icon={CardsIcon}
          value={resourceCount}
          title={atRiskOnSeven ? 'Resource cards: discards on a 7' : 'Resource cards in hand'}
          tone={atRiskOnSeven ? 'danger' : 'slate'}
        />
        <Stat
          icon={DevCardIcon}
          value={devCardCount}
          title="Unplayed development cards"
          tone="violet"
        />
      </div>
    </li>
  );
}

/** Row of heraldic seat chips that floats over the top edge of the board. */
export default function PlayerStatusBar({
  players,
  currentTurnPlayerId,
  myPlayerId,
  largestArmyHolderId,
  longestRoadHolderId,
}) {
  return (
    <ul
      aria-label="Players"
      className="pointer-events-none flex min-w-0 max-w-full flex-nowrap items-stretch justify-center gap-1.5 overflow-x-auto px-1 max-md:gap-1"
    >
      {players.map((player) => (
        <PlayerChip
          key={player.id}
          player={player}
          isCurrentTurn={player.id === currentTurnPlayerId}
          isMe={player.id === myPlayerId}
          hasLargestArmy={player.id === largestArmyHolderId}
          hasLongestRoad={player.id === longestRoadHolderId}
        />
      ))}
    </ul>
  );
}
