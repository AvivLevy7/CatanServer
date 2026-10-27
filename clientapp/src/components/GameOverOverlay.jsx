const PLAYER_BG = {
  Red: 'bg-red-500',
  Blue: 'bg-blue-500',
  Orange: 'bg-orange-500',
  White: 'bg-stone-100',
};

/**
 * Full-screen overlay shown when the phase is GameOver. Sits above the board so
 * no further interaction is possible until a new game is started.
 */
export default function GameOverOverlay({ winner, players, onNewGame, disabled }) {
  if (!winner) return null;

  const standings = [...players].sort((a, b) => b.victoryPoints - a.victoryPoints);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameover-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-sky-900 p-8 text-center shadow-2xl ring-2 ring-amber-300">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">Game Over</p>
        <h2 id="gameover-title" className="mt-2 text-3xl font-black text-amber-50">
          {winner.name} Wins!
        </h2>
        <p className="mt-1 flex items-center justify-center gap-2 text-sm text-sky-200">
          <span className={`inline-block size-3 rounded-full ${PLAYER_BG[winner.color] ?? 'bg-stone-400'}`} />
          {winner.color} reached {winner.victoryPoints} victory points
        </p>

        <ol className="mt-6 flex flex-col gap-1 text-left">
          {standings.map((p, i) => (
            <li
              key={p.id}
              className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${
                p.id === winner.id ? 'bg-amber-200/90 font-bold text-stone-900' : 'bg-sky-800/70 text-amber-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="w-4 text-xs opacity-70">{i + 1}.</span>
                <span className={`inline-block size-2.5 rounded-full ${PLAYER_BG[p.color] ?? 'bg-stone-400'}`} />
                {p.name}
              </span>
              <span>{p.victoryPoints} VP</span>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={onNewGame}
          disabled={disabled}
          className="mt-6 w-full rounded-lg bg-amber-100 px-4 py-2.5 text-sm font-semibold text-stone-900 shadow transition hover:bg-amber-50 disabled:opacity-50"
        >
          Start a new game
        </button>
      </div>
    </div>
  );
}
