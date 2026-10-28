import DiceStatsChart from './DiceStatsChart';

const PLAYER_BG = {
  Red: 'bg-seat-red shadow-[0_0_8px_var(--color-seat-red-glow)]',
  Blue: 'bg-seat-blue shadow-[0_0_8px_var(--color-seat-blue-glow)]',
  Orange: 'bg-seat-orange shadow-[0_0_8px_var(--color-seat-orange-glow)]',
  White: 'bg-seat-white shadow-[0_0_8px_var(--color-seat-white-glow)]',
};

const VP_COLUMNS = [
  { key: 'settlements', label: 'Settle.', title: 'Settlements (1 VP each)' },
  { key: 'cities', label: 'Cities', title: 'Cities (2 VP each)' },
  { key: 'longestRoad', label: 'Road', title: 'Longest Road (+2)' },
  { key: 'largestArmy', label: 'Army', title: 'Largest Army (+2)' },
  { key: 'victoryPointCards', label: 'VP cards', title: 'Victory Point development cards' },
];

/**
 * Full-screen overlay shown when the phase is GameOver. Sits above the board so
 * no further interaction is possible until a new game is started.
 */
export default function GameOverOverlay({
  winner,
  players,
  diceFrequencies,
  isHost,
  onPlayAgain,
  onNewGame,
  disabled,
}) {
  if (!winner) return null;

  const standings = [...players].sort((a, b) => b.victoryPoints - a.victoryPoints);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameover-title"
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/80 p-4"
    >
      <div className="my-auto w-full max-w-2xl shrink-0 rounded-2xl border border-amber-700/50 bg-gray-900/90 backdrop-blur-md p-6 text-center shadow-2xl ring-2 ring-amber-400/80 shadow-[0_0_40px_rgba(245,190,90,0.25)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">Game Over</p>
        <h2 id="gameover-title" className="mt-2 font-display text-4xl font-black tracking-wide text-parchment-50">
          {winner.name} Wins!
        </h2>
        <p className="mt-1 flex items-center justify-center gap-2 text-sm text-parchment-200">
          <span className={`inline-block size-3 rounded-full ${PLAYER_BG[winner.color] ?? 'bg-stone-400'}`} />
          {winner.color} reached {winner.victoryPoints} victory points
        </p>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm" aria-label="Final scoreboard">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-parchment-300/80">
                <th className="py-1 pr-2 font-semibold">Player</th>
                {VP_COLUMNS.map((c) => (
                  <th key={c.key} className="px-1 py-1 text-center font-semibold" title={c.title}>
                    {c.label}
                  </th>
                ))}
                <th className="py-1 pl-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((p, i) => {
                const vp = p.victoryPointBreakdown ?? {};
                const isWinner = p.id === winner.id;
                return (
                  <tr
                    key={p.id}
                    className={isWinner ? 'bg-amber-200/90 font-bold text-stone-900' : 'bg-gray-900/70 ring-1 ring-amber-800/40 text-parchment-50'}
                  >
                    <td className="rounded-l-lg py-1.5 pl-3 pr-2">
                      <span className="flex items-center gap-2">
                        <span className="w-4 text-xs opacity-70">{i + 1}.</span>
                        <span className={`inline-block size-2.5 rounded-full ${PLAYER_BG[p.color] ?? 'bg-stone-400'}`} />
                        {p.name}
                      </span>
                    </td>
                    {VP_COLUMNS.map((c) => (
                      <td key={c.key} className="px-1 py-1.5 text-center tabular-nums">
                        {vp[c.key] ?? '-'}
                      </td>
                    ))}
                    <td className="rounded-r-lg py-1.5 pl-2 pr-3 text-right tabular-nums">{p.victoryPoints} VP</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 rounded-xl bg-black/30 ring-1 ring-amber-900/30 p-4 text-left">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-parchment-300/80">Dice this game</h3>
          <DiceStatsChart frequencies={diceFrequencies} compact />
        </div>

        {isHost ? (
          <button
            type="button"
            onClick={onPlayAgain}
            disabled={disabled}
            className="mt-6 w-full rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-stone-900 shadow transition hover:bg-emerald-300 disabled:opacity-50"
          >
            Play again
          </button>
        ) : (
          <p className="mt-6 text-xs text-parchment-300/80">Waiting for the host to start a new game...</p>
        )}

        <button
          type="button"
          onClick={onNewGame}
          disabled={disabled}
          className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold shadow transition disabled:opacity-50 ${
            isHost
              ? 'mt-2 border border-amber-100/40 text-parchment-50 hover:bg-gray-800'
              : 'mt-3 bg-amber-100 text-stone-900 hover:bg-amber-50'
          }`}
        >
          Leave room
        </button>
      </div>
    </div>
  );
}
