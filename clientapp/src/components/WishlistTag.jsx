import { useEffect, useRef, useState } from 'react';
import { RESOURCES } from '../resources';
import { RESOURCE_STYLE } from '../theme';
import { TagIcon } from './icons';

/** A row of the five resources plus a "nothing" option, for one side of the notice. */
function ResourceRow({ legend, value, onPick, accent }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-12 shrink-0 font-display text-[9px] font-bold uppercase tracking-[0.15em] ${accent}`}>
        {legend}
      </span>
      <div className="flex items-center gap-1">
        {RESOURCES.map(({ key, label }) => {
          const style = RESOURCE_STYLE[key];
          const picked = value === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPick(picked ? null : key)}
              title={label}
              aria-label={`${legend} ${label}`}
              aria-pressed={picked}
              className={`flex size-7 items-center justify-center rounded-md bg-gradient-to-b text-sm leading-none transition-transform hover:scale-110 ${style.card} ${style.ink} ${
                picked ? 'ring-2 ring-amber-200 scale-110' : 'opacity-50 ring-1 ring-black/40'
              }`}
            >
              <span aria-hidden="true">{style.glyph}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A standing "wanted / for sale" notice any player can pin to their own seat, on or off
 * turn, so whoever is playing can see at a glance who to approach before writing an offer.
 *
 * It is advertising, not a commitment: nothing here moves a card or binds anyone to a deal.
 */
export default function WishlistTag({ wants, offers, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const active = wants != null || offers != null;

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

  return (
    <div ref={rootRef} className="pointer-events-none relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title={
          active
            ? `Advertising: want ${wants ?? 'nothing'}, offering ${offers ?? 'nothing'}`
            : 'Advertise what you want and what you will part with'
        }
        aria-label="Wanted and for sale"
        aria-expanded={open}
        className={`pointer-events-auto relative flex size-11 items-center justify-center rounded-xl border shadow-xl backdrop-blur-md transition-all hover:scale-110 disabled:pointer-events-none disabled:opacity-35 max-md:size-9 max-md:rounded-lg ${
          open || active
            ? 'border-amber-300 bg-amber-400/90 text-ink-900'
            : 'border-amber-700/50 bg-gray-900/85 text-parchment-100 hover:border-amber-400'
        }`}
      >
        <TagIcon className="size-5 max-md:size-4" />
        {active && !open && (
          <span className="absolute -right-1 -top-1 flex items-center gap-px rounded-full border border-amber-100 bg-ink-900 px-0.5 text-[9px] leading-none">
            {wants && <span aria-hidden="true">{RESOURCE_STYLE[wants]?.glyph}</span>}
            {offers && <span aria-hidden="true">{RESOURCE_STYLE[offers]?.glyph}</span>}
          </span>
        )}
      </button>

      {open && (
        <div
          role="group"
          aria-label="Set what you want and what you offer"
          className="panel-glass pointer-events-auto absolute bottom-full left-0 mb-2 flex w-max flex-col gap-2 p-2.5"
        >
          <ResourceRow
            legend="Want"
            value={wants ?? null}
            accent="text-emerald-300/90"
            onPick={(key) => onChange(key, offers ?? null)}
          />
          <ResourceRow
            legend="Offer"
            value={offers ?? null}
            accent="text-amber-300/90"
            onPick={(key) => onChange(wants ?? null, key)}
          />
          {active && (
            <button
              type="button"
              onClick={() => {
                onChange(null, null);
                setOpen(false);
              }}
              className="mt-0.5 rounded-md border border-amber-100/30 px-2 py-1 text-[11px] text-parchment-100 transition hover:bg-gray-800"
            >
              Take the notice down
            </button>
          )}
        </div>
      )}
    </div>
  );
}
