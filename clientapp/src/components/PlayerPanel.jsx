// Server PlayerColor enum -> Tailwind classes.
const PLAYER_COLORS = {
  Red: { dot: 'bg-red-500', ring: 'ring-red-400' },
  Blue: { dot: 'bg-blue-500', ring: 'ring-blue-400' },
  Orange: { dot: 'bg-orange-500', ring: 'ring-orange-400' },
  White: { dot: 'bg-stone-100', ring: 'ring-stone-200' },
};

// Server ResourceType names -> display labels (classic Catan vocabulary).
const RESOURCES = [
  { key: 'Lumber', label: 'Wood', abbr: 'WD', chip: 'bg-green-700 text-green-50' },
  { key: 'Brick', label: 'Brick', abbr: 'BR', chip: 'bg-red-700 text-red-50' },
  { key: 'Grain', label: 'Wheat', abbr: 'WH', chip: 'bg-yellow-500 text-yellow-950' },
  { key: 'Wool', label: 'Sheep', abbr: 'SH', chip: 'bg-lime-300 text-lime-950' },
  { key: 'Ore', label: 'Ore', abbr: 'OR', chip: 'bg-slate-500 text-slate-50' },
];

function AchievementBadge({ label, title, className }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${className}`}
      title={title}
    >
      {label}
    </span>
  );
}

function PlayerCard({ player, isCurrentTurn, isMe, hasLargestArmy, hasLongestRoad }) {
  const colors = PLAYER_COLORS[player.color] ?? PLAYER_COLORS.White;

  return (
    <li
      className={`rounded-xl bg-sky-800/70 p-3 transition ${
        isCurrentTurn ? `ring-2 ${colors.ring} shadow-lg shadow-black/30` : 'opacity-80'
      }`}
      aria-current={isCurrentTurn ? 'true' : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-block size-3 rounded-full ${colors.dot}`} />
          <span className="font-semibold text-amber-50">{player.name}</span>
          {isMe && <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-300">(you)</span>}
          {isCurrentTurn && (
            <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-900">
              Turn
            </span>
          )}
          {hasLargestArmy && (
            <AchievementBadge
              label="Army"
              title="Largest Army (+2 VP)"
              className="bg-rose-600 text-rose-50"
            />
          )}
          {hasLongestRoad && (
            <AchievementBadge
              label="Road"
              title="Longest Road (+2 VP)"
              className="bg-emerald-600 text-emerald-50"
            />
          )}
        </div>
        <span className="text-sm text-amber-100" title="Victory points">
          <span className="font-bold">{player.victoryPoints}</span> VP
        </span>
      </div>

      <ul className="mt-2 grid grid-cols-5 gap-1 text-center">
        {RESOURCES.map(({ key, label, abbr, chip }) => (
          <li key={key} className="rounded bg-sky-900/60 py-1" title={label}>
            <div className={`mx-auto w-fit rounded px-1 text-[10px] font-bold leading-4 ${chip}`}>{abbr}</div>
            <div className="mt-0.5 text-xs font-semibold text-amber-50">
              {player.resources?.[key] ?? 0}
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-2 flex justify-between text-[11px] text-sky-200" aria-label="Pieces remaining">
        <span title="Roads left">Roads {player.roadsRemaining ?? '-'}</span>
        <span title="Settlements left">Settlements {player.settlementsRemaining ?? '-'}</span>
        <span title="Cities left">Cities {player.citiesRemaining ?? '-'}</span>
      </p>

      <p className="mt-1 flex justify-between text-[11px] text-sky-200" aria-label="Achievement progress">
        <span title="Longest continuous road (5 needed)" className={hasLongestRoad ? 'font-bold text-emerald-300' : ''}>
          Road length {player.longestRoadLength ?? 0}
        </span>
        <span title="Knights played (3 needed)" className={hasLargestArmy ? 'font-bold text-rose-300' : ''}>
          Knights {player.knightsPlayed ?? 0}
        </span>
      </p>
    </li>
  );
}

export default function PlayerPanel({ players, currentTurnPlayerId, myPlayerId, largestArmyHolderId, longestRoadHolderId }) {
  return (
    <section aria-label="Players">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-300">Players</h2>
      <ul className="flex flex-col gap-2">
        {players.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            isCurrentTurn={player.id === currentTurnPlayerId}
            isMe={player.id === myPlayerId}
            hasLargestArmy={player.id === largestArmyHolderId}
            hasLongestRoad={player.id === longestRoadHolderId}
          />
        ))}
      </ul>
    </section>
  );
}
