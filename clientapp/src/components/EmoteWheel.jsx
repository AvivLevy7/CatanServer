import { useEffect, useRef, useState } from 'react';
import { EMOTES } from '../emotes';
import { EmoteIcon } from './icons';

// Arc the buttons bloom into: up and to the right of the launcher, which sits in the
// bottom-left corner. Angles are degrees, 0 = due right, negative = upward. The arc stops
// at vertical so no button is pushed off the left edge of a phone screen.
const ARC_FROM = -88;
const ARC_TO = -4;

// One emote every so often, so the table cannot be papered over with speech bubbles.
const COOLDOWN_MS = 1400;

/**
 * Quick-emote launcher: a small floating button by the player's own controls that opens
 * a bloom of visual reactions. Sending one broadcasts it to the room, where it pops as a
 * speech bubble over the sender's seat chip.
 *
 * Emote ids are fixed on both sides of the wire, so nothing a player types can ride
 * along - the only thing sent is which of the six was chosen.
 */
export default function EmoteWheel({ onEmote, disabled }) {
  const [open, setOpen] = useState(false);
  const [cooling, setCooling] = useState(false);
  const rootRef = useRef(null);
  const cooldownRef = useRef(null);

  // Click-away and Escape both close the wheel.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(cooldownRef.current), []);

  const send = (id) => {
    if (cooling || disabled) return;
    onEmote(id);
    setOpen(false);
    setCooling(true);
    cooldownRef.current = setTimeout(() => setCooling(false), COOLDOWN_MS);
  };

  const radius = 86;

  return (
    // On a phone the hand can reach the left edge, so the launcher sits above it rather
    // than beside it; on desktop there is room alongside.
    <div
      ref={rootRef}
      className="pointer-events-none fixed bottom-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.5rem))] left-3 z-[35] max-md:bottom-[calc(5.25rem+env(safe-area-inset-bottom))] max-md:left-[max(0.375rem,env(safe-area-inset-left))]"
    >
      <div className="relative">
        {open &&
          EMOTES.map((emote, i) => {
            const t = EMOTES.length === 1 ? 0 : i / (EMOTES.length - 1);
            const angle = ((ARC_FROM + t * (ARC_TO - ARC_FROM)) * Math.PI) / 180;
            return (
              <button
                key={emote.id}
                type="button"
                onClick={() => send(emote.id)}
                disabled={disabled || cooling}
                title={emote.label}
                aria-label={emote.label}
                className="animate-emote-bloom pointer-events-auto absolute bottom-0 left-0 flex size-11 items-center justify-center rounded-full border border-amber-500/60 bg-gray-900/95 text-xl shadow-xl backdrop-blur-md transition-colors hover:border-amber-300 hover:bg-gray-800 disabled:opacity-40 max-md:size-10 max-md:text-lg"
                style={{
                  '--ex': `${(Math.cos(angle) * radius).toFixed(1)}px`,
                  '--ey': `${(Math.sin(angle) * radius).toFixed(1)}px`,
                  animationDelay: `${i * 32}ms`,
                }}
              >
                <span aria-hidden="true">{emote.glyph}</span>
              </button>
            );
          })}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={disabled}
          title={cooling ? 'Catch your breath first' : open ? 'Close emotes' : 'Send an emote'}
          aria-label={open ? 'Close emotes' : 'Send an emote'}
          aria-expanded={open}
          className={`pointer-events-auto relative flex size-11 items-center justify-center rounded-xl border shadow-xl backdrop-blur-md transition-all hover:scale-110 disabled:pointer-events-none disabled:opacity-35 max-md:size-9 max-md:rounded-lg ${
            open
              ? 'border-amber-300 bg-amber-400/90 text-ink-900'
              : 'border-amber-700/50 bg-gray-900/85 text-parchment-100 hover:border-amber-400'
          } ${cooling ? 'opacity-50' : ''}`}
        >
          <EmoteIcon className="size-5 max-md:size-4" />
        </button>
      </div>
    </div>
  );
}
