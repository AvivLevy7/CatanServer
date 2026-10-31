import { useEffect, useState } from 'react';
import { emoteById } from '../emotes';

/**
 * Comic-style speech bubbles for live emotes, drawn in their own fixed layer.
 *
 * They are not nested inside the seat chips on purpose: the status row scrolls
 * horizontally when the table is full, and a scroll container clips anything hanging out
 * of it. Instead each bubble is placed against the measured position of its sender's chip
 * (`data-player-id`), which keeps it visible however the row is laid out.
 *
 * @param {object} emotes map of playerId -> { id, emote } for the emotes still on screen
 */
export default function EmoteBubbleLayer({ emotes }) {
  const active = Object.entries(emotes ?? {});
  const signature = active.map(([playerId, e]) => `${playerId}:${e.id}`).join('|');
  const [anchors, setAnchors] = useState({});

  useEffect(() => {
    const measure = () => {
      const next = {};
      for (const [playerId] of Object.entries(emotes ?? {})) {
        const chip = document.querySelector(`[data-player-id="${playerId}"]`);
        if (!chip) continue;
        const box = chip.getBoundingClientRect();
        if (box.width === 0) continue;
        next[playerId] = { x: box.left + box.width / 2, y: box.bottom };
      }
      setAnchors(next);
    };

    measure();
    // A bubble lives for three seconds; re-measuring on resize is enough to keep it
    // attached without polling the layout every frame.
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (active.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[39]" aria-live="polite">
      {active.map(([playerId, emote]) => {
        const anchor = anchors[playerId];
        if (!anchor) return null;
        const { glyph, line, label } = emoteById(emote.emote);

        return (
          <div
            // Keyed on the emote so a second emote from the same seat replays the pop.
            key={`${playerId}:${emote.id}`}
            className="animate-bubble-pop absolute origin-top -translate-x-1/2"
            style={{ left: `${anchor.x}px`, top: `${anchor.y + 8}px` }}
          >
            {/* Tail, pointing back up at the chip. */}
            <span
              aria-hidden="true"
              className="absolute -top-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 border-l-2 border-t-2 border-amber-200 bg-parchment-50"
            />
            <span className="flex max-w-[11rem] items-center gap-1.5 whitespace-nowrap rounded-xl border-2 border-amber-200 bg-parchment-50 px-2.5 py-1 font-display text-[11px] font-bold text-ink-900 shadow-[0_6px_16px_rgba(0,0,0,0.6)] max-md:max-w-[8.5rem] max-md:px-2 max-md:text-[10px]">
              <span aria-hidden="true" className="text-base leading-none max-md:text-sm">
                {glyph}
              </span>
              <span className="truncate">{line}</span>
              <span className="sr-only">
                {emote.senderName ? `${emote.senderName}: ` : ''}
                {label}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
