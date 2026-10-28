import { seat, RESOURCE_STYLE } from '../theme';
import { RESOURCES } from '../resources';

/** Heraldic shield badge used for VP / Knights / Road. */
function Shield({ value, label, title, tone = 'gold', lit = false }) {
  const tones = {
    gold: 'from-amber-200 via-amber-400 to-amber-700 text-ink-900',
    crimson: 'from-rose-300 via-rose-500 to-rose-900 text-rose-50',
    emerald: 'from-emerald-200 via-emerald-500 to-emerald-900 text-emerald-50',
    slate: 'from-stone-400 via-stone-600 to-stone-900 text-stone-100',
  };
  return (
    <div className="flex flex-col items-center gap-0.5" title={title}>
      <div
        className={`relative flex h-9 w-8 items-center justify-center bg-gradient-to-b font-display text-sm font-black tabular-nums shadow-lg ring-1 ring-black/40 transition-all hover:scale-110 ${
          tones[tone]
        } ${lit ? 'animate-glow' : ''}`}
        style={{ clipPath: 'polygon(0 0, 100% 0, 100% 62%, 50% 100%, 0 62%)' }}
      >
        {value}
      </div>
      <span className="font-display text-[9px] uppercase tracking-widest text-parchment-300/80">{label}</span>
    </div>
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
      className={`panel-glass relative flex min-w-0 flex-1 flex-col gap-2 overflow-hidden px-3 py-2 transition-all ${
        isCurrentTurn ? `ring-2 ${s.ring} shadow-[0_0_24px_rgba(245,190,90,0.25)]` : 'opacity-85 hover:opacity-100'
      }`}
    >
      {/* Heraldic colour band */}
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${s.gradient}`} />

      <div className="flex items-center gap-2 pl-1">
        <span className={`inline-block size-3 rounded-full ring-1 ring-black/40 ${s.dot}`} />
        <span className="truncate font-display text-base font-bold tracking-wide text-parchment-50">{player.name}</span>
        {isMe && <span className="font-display text-[9px] uppercase tracking-widest text-amber-300/80">you</span>}
        {isCurrentTurn && (
          <span className="ml-auto rounded-sm bg-gradient-to-b from-amber-200 to-amber-500 px-1.5 py-0.5 font-display text-[9px] font-black uppercase tracking-widest text-ink-900 shadow">
            Turn
          </span>
        )}
      </div>

      <div className="flex items-start gap-3 pl-1">
        <Shield value={player.victoryPoints} label="VP" title="Victory points" tone="gold" lit={isCurrentTurn} />
        <Shield
          value={player.knightsPlayed ?? 0}
          label="Knights"
          title={hasLargestArmy ? 'Largest Army (+2 VP)' : 'Knights played'}
          tone={hasLargestArmy ? 'crimson' : 'slate'}
          lit={hasLargestArmy}
        />
        <Shield
          value={player.longestRoadLength ?? 0}
          label="Road"
          title={hasLongestRoad ? 'Longest Road (+2 VP)' : 'Longest road length'}
          tone={hasLongestRoad ? 'emerald' : 'slate'}
          lit={hasLongestRoad}
        />

        <div className="ml-auto flex flex-col items-end gap-1 text-[11px]">
          {isMe ? (
            <ul className="flex gap-1" aria-label="Your resources">
              {RESOURCES.map(({ key, label }) => {
                const r = RESOURCE_STYLE[key];
                return (
                  <li
                    key={key}
                    title={label}
                    className={`flex h-9 w-7 flex-col items-center justify-center rounded bg-gradient-to-b ${r.card} ${r.ink} ring-1 text-[10px] font-bold shadow transition-all hover:scale-110`}
                  >
                    <span className="text-xs leading-none">{r.glyph}</span>
                    <span className="leading-none">{player.resources?.[key] ?? 0}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <>
              <span
                className={`rounded px-1.5 py-0.5 font-display font-semibold ring-1 ${
                  atRiskOnSeven
                    ? 'bg-rose-950/80 text-rose-200 ring-rose-500/60'
                    : 'bg-ink-900/70 text-parchment-100 ring-amber-800/40'
                }`}
                title={atRiskOnSeven ? 'Holds more than 7 cards: discards on a 7' : 'Resource cards in hand'}
              >
                {resourceCount} cards
              </span>
              <span
                className="rounded bg-violet-950/80 px-1.5 py-0.5 font-display font-semibold text-violet-200 ring-1 ring-violet-500/50"
                title="Unplayed development cards"
              >
                {devCardCount} dev
              </span>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

/** Horizontal strip of heraldic player cards for the top of the game screen. */
export default function PlayerStatusBar({
  players,
  currentTurnPlayerId,
  myPlayerId,
  largestArmyHolderId,
  longestRoadHolderId,
  timer,
}) {
  return (
    <section aria-label="Players" className="flex flex-wrap items-stretch gap-2">
      <ul className="flex min-w-0 flex-1 flex-wrap gap-2">
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
      {timer}
    </section>
  );
}
