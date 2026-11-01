import { useEffect, useState } from 'react';
import { UndoIcon } from './icons';

const LABELS = {
  Road: 'road',
  Settlement: 'settlement',
};

// Mirrors BuildRules.UndoWindow on the server; only the bar's length depends on it, and
// the countdown itself is read from the server's deadline.
const UNDO_WINDOW_MS = 3000;

/**
 * The short window in which a misclick can be taken back.
 *
 * Touchscreens make it far too easy to drop a road one path over from the one you meant,
 * and the board itself is the build control, so there is no confirmation step to catch it.
 * This is that step, after the fact: a few seconds in which the piece can come back off
 * the board, cost and all.
 *
 * The server owns the rule - it refuses a late undo and withdraws the offer as soon as
 * anything random happens (a card drawn, the dice rolled) - so this only has to show the
 * window the state already says is open, and count it down honestly.
 *
 * @param {{playerId: string, kind: string, pieceId: string, expiresAt: string} | null} undoable
 */
export default function UndoBuildButton({ undoable, onUndo, disabled }) {
  const expiresAt = undoable ? new Date(undoable.expiresAt).getTime() : 0;
  const [now, setNow] = useState(() => Date.now());
  const [sent, setSent] = useState(null);

  // One ticker per window, at a rate the eye reads as a smooth drain.
  useEffect(() => {
    if (!expiresAt) return undefined;
    const id = setInterval(() => setNow(Date.now()), 80);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (!undoable) return null;

  const remaining = expiresAt - now;
  if (remaining <= 0) return null;

  // The bar drains over the server's window (BuildRules.UndoWindow), and the countdown
  // itself comes from the server's own deadline, so the two cannot disagree.
  const fraction = Math.max(0, Math.min(1, remaining / UNDO_WINDOW_MS));
  const piece = LABELS[undoable.kind] ?? 'build';
  const busy = sent === undoable.pieceId;

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={() => {
        setSent(undoable.pieceId);
        onUndo();
      }}
      title={`Take that ${piece} back`}
      className="animate-fade-in pointer-events-auto relative flex max-w-full items-center gap-2 overflow-hidden rounded-full border border-amber-300/70 bg-gray-900/90 pl-3 pr-3.5 py-1.5 font-display text-xs font-bold tracking-wide text-amber-100 shadow-xl backdrop-blur transition hover:border-amber-200 hover:bg-gray-900 disabled:opacity-50"
    >
      {/* The window draining away, as a bar across the foot of the pill. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-gradient-to-r from-amber-300 to-amber-500 transition-[width] duration-75 ease-linear"
        style={{ width: `${fraction * 100}%` }}
      />
      <UndoIcon className="size-4 shrink-0" />
      <span className="truncate">{busy ? 'Taking it back…' : `Undo ${piece}`}</span>
      <span className="font-mono text-[11px] tabular-nums text-amber-300/80">
        {Math.ceil(remaining / 1000)}s
      </span>
    </button>
  );
}
