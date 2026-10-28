const PLAYER_DOT = {
  Red: 'bg-seat-red shadow-[0_0_8px_var(--color-seat-red-glow)]',
  Blue: 'bg-seat-blue shadow-[0_0_8px_var(--color-seat-blue-glow)]',
  Orange: 'bg-seat-orange shadow-[0_0_8px_var(--color-seat-orange-glow)]',
  White: 'bg-seat-white shadow-[0_0_8px_var(--color-seat-white-glow)]',
};

/**
 * Small chooser shown when the robber's destination touches more than one
 * opponent. The thief picks who loses a card.
 */
export default function StealPicker({ candidates, onPick, onCancel, disabled }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="steal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-sm rounded-2xl border border-amber-700/50 bg-gray-900/90 backdrop-blur-md p-5 shadow-2xl ring-1 ring-amber-700/50">
        <h2 id="steal-title" className="font-display text-lg font-bold tracking-wide text-parchment-50">
          Who do you steal from?
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {candidates.map((player) => (
            <li key={player.id}>
              <button
                type="button"
                onClick={() => onPick(player.id)}
                disabled={disabled}
                className="flex w-full items-center justify-between rounded-lg bg-gray-900/70 ring-1 ring-amber-800/40 px-3 py-2 text-left text-sm text-parchment-50 transition hover:bg-gray-800 disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <span className={`inline-block size-3 rounded-full ${PLAYER_DOT[player.color] ?? 'bg-stone-400'}`} />
                  {player.name}
                </span>
                <span className="text-xs text-parchment-300/80">
                  {player.resourceCardCount ?? Object.values(player.resources ?? {}).reduce((s, n) => s + n, 0)} cards
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 w-full rounded-lg border border-amber-100/40 px-3 py-1.5 text-sm text-parchment-50 hover:bg-gray-800"
        >
          Pick a different tile
        </button>
      </div>
    </div>
  );
}
