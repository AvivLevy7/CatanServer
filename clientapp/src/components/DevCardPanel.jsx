const CARD_META = {
  Knight: { label: 'Knight', chip: 'bg-red-700 text-red-50', hint: 'Move the robber and steal a card' },
  VictoryPoint: { label: 'Victory Point', chip: 'bg-amber-400 text-amber-950', hint: '+1 VP (already counted)' },
  Monopoly: { label: 'Monopoly', chip: 'bg-purple-600 text-purple-50', hint: 'Take all of one resource from everyone' },
  YearOfPlenty: { label: 'Year of Plenty', chip: 'bg-green-700 text-green-50', hint: 'Take any 2 resources from the bank' },
  RoadBuilding: { label: 'Road Building', chip: 'bg-stone-500 text-stone-50', hint: 'Build 2 free roads' },
};

const DEV_CARD_COST = 'Ore + Wheat + Sheep';

/**
 * The current player's development cards with buy/play controls. Only Knights are
 * playable for now; the other action cards are shown but inert until implemented.
 */
export default function DevCardPanel({ player, deckRemaining, onBuy, onPlay, disabled }) {
  const cards = player?.developmentCards ?? [];
  const unplayed = cards.filter((c) => !c.isPlayed);
  const played = cards.filter((c) => c.isPlayed);

  const r = player?.resources ?? {};
  const canAfford = (r.Ore ?? 0) >= 1 && (r.Grain ?? 0) >= 1 && (r.Wool ?? 0) >= 1;

  return (
    <section aria-label="Development cards" className="rounded-xl bg-sky-800/70 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-sky-300">My Cards</h2>
        <span className="text-xs text-sky-300">Deck: {deckRemaining ?? '-'}</span>
      </div>

      <button
        type="button"
        onClick={onBuy}
        disabled={disabled || !canAfford || deckRemaining === 0}
        title={DEV_CARD_COST}
        className="w-full rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold text-stone-900 shadow transition hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Buy Dev Card <span className="font-normal text-stone-600">({DEV_CARD_COST})</span>
      </button>

      {unplayed.length === 0 ? (
        <p className="mt-3 text-center text-xs text-sky-300">No cards in hand</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {unplayed.map((card) => {
            const meta = CARD_META[card.type] ?? { label: card.type, chip: 'bg-stone-500 text-stone-50', hint: '' };
            const isVp = card.type === 'VictoryPoint';
            return (
              <li
                key={card.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-sky-900/60 px-3 py-2"
                title={meta.hint}
              >
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${meta.chip}`}>
                  {meta.label}
                </span>
                {isVp ? (
                  <span className="text-[11px] text-sky-300">Scored</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onPlay(card)}
                    disabled={disabled || !card.canPlayNow}
                    title={card.canPlayNow ? meta.hint : 'Playable from your next turn'}
                    className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold text-stone-900 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Play
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {(played.length > 0 || (player?.knightsPlayed ?? 0) > 0) && (
        <p className="mt-3 text-[11px] text-sky-200">
          Knights played: <span className="font-bold text-amber-100">{player.knightsPlayed}</span>
          {played.length > 0 && <span className="text-sky-300"> &middot; {played.length} card{played.length === 1 ? '' : 's'} used</span>}
        </p>
      )}
    </section>
  );
}
