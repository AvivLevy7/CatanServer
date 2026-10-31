import { seat } from '../theme';

// How long one line stays on screen. Must match the --life the CSS animation reads.
export const MINI_LOG_LIFE_MS = 5200;

// Only ever the last few, so the feed stays a glance rather than a read.
const VISIBLE = 3;

/**
 * A glanceable event feed: the last three things that happened, as icons and seat colours
 * rather than sentences, fading out on their own.
 *
 * It is deliberately not the game log - that still lives in the side drawer with the full
 * wording. This is the version you can read without looking away from the board, which is
 * why every entry is a glyph or two and a name.
 *
 * @param {Array} entries newest last; each { id, playerId, playerName, parts }
 */
export default function MiniLog({ entries, players }) {
  const recent = entries.slice(-VISIBLE);
  if (recent.length === 0) return null;

  const colorOf = (playerId) => seat(players.find((p) => p.id === playerId)?.color);

  return (
    <ul
      aria-label="Recent events"
      aria-live="off"
      className="pointer-events-none fixed bottom-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.5rem))] right-[5.25rem] z-[31] flex w-max max-w-[min(22rem,45vw)] flex-col items-end gap-1 max-md:bottom-[calc(4.25rem+env(safe-area-inset-bottom))] max-md:right-[max(0.375rem,env(safe-area-inset-right))] max-md:max-w-[62vw]"
    >
      {recent.map((entry) => {
        const s = colorOf(entry.playerId);
        return (
          <li
            key={entry.id}
            className="animate-mini-log flex items-center gap-1.5 rounded-full border border-amber-800/40 bg-gray-900/70 px-2 py-1 text-[11px] shadow-lg backdrop-blur-sm max-md:gap-1 max-md:px-1.5 max-md:text-[10px]"
            style={{ '--life': `${MINI_LOG_LIFE_MS}ms` }}
          >
            <span aria-hidden="true" className={`inline-block size-2 shrink-0 rounded-full ${s.dot}`} />
            <span className={`max-w-[5rem] truncate font-display text-[10px] font-bold ${s.text} max-md:max-w-[3.5rem]`}>
              {entry.playerName}
            </span>
            <span className="flex items-center gap-1 text-parchment-100">{entry.parts}</span>
          </li>
        );
      })}
    </ul>
  );
}
