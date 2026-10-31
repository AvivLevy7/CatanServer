import { useEffect, useRef, useState } from 'react';
import { BUILDS, canAfford, missingFor } from '../buildCosts';
import { RESOURCE_STYLE } from '../theme';
import { RESOURCES } from '../resources';
import { CityIcon, DevCardIcon, HammerIcon, RoadIcon, SettlementIcon, TradeIcon } from './icons';

const PIECE_ICON = {
  road: RoadIcon,
  settlement: SettlementIcon,
  city: CityIcon,
  developmentCard: DevCardIcon,
};

/** The cost of a build, as the actual resource cards. */
function CostChips({ cost, resources, dim = false }) {
  return (
    <span className="flex items-center gap-0.5">
      {Object.entries(cost).flatMap(([key, amount]) =>
        Array.from({ length: amount }, (_, i) => {
          const style = RESOURCE_STYLE[key];
          const held = (resources?.[key] ?? 0) > i;
          return (
            <span
              key={`${key}-${i}`}
              title={RESOURCES.find((r) => r.key === key)?.label ?? key}
              className={`flex size-4 items-center justify-center rounded-[3px] bg-gradient-to-b text-[9px] leading-none ring-1 ring-black/40 ${style.card} ${
                held && !dim ? '' : 'opacity-30 grayscale'
              }`}
            >
              <span aria-hidden="true">{style.glyph}</span>
            </span>
          );
        }),
      )}
    </span>
  );
}

/**
 * The build palette: what the player can put on the board, what each costs, and - the
 * point of it - what to do when they cannot afford one.
 *
 * A build they are short on is not disabled. Clicking it opens the trade desk with exactly
 * the missing cards already filled into the "requesting" side, which turns "I can't build
 * this" straight into an offer the table can answer. Hovering any row tells the hand which
 * cards would be spent, so the cost is shown on the actual cards rather than only as icons.
 */
export default function BuildMenu({
  open,
  onOpenChange,
  resources,
  piecesRemaining,
  deckRemaining,
  onPreview,
  onBuild,
  onTradeFor,
  canBuild,
  disabledReason,
}) {
  const rootRef = useRef(null);
  const [hovered, setHovered] = useState(null);

  // Tell the hand which cards to lift: whatever row the pointer is on while the menu is
  // open, and nothing once it closes - without having to reset our own state to do it.
  const preview = open ? hovered : null;
  useEffect(() => {
    onPreview?.(preview);
  }, [preview, onPreview]);

  // Leaving the preview behind would lift the wrong cards the next time the menu opens.
  useEffect(() => () => onPreview?.(null), [onPreview]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) onOpenChange(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={rootRef} className="pointer-events-none relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        title={canBuild ? 'What you can build' : disabledReason}
        aria-label="Build menu"
        aria-expanded={open}
        className={`pointer-events-auto relative flex size-12 items-center justify-center rounded-xl border text-parchment-100 shadow-xl backdrop-blur-md transition-all hover:scale-110 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-35 max-md:size-10 max-md:rounded-lg ${
          open
            ? 'border-amber-300 bg-amber-400/90 text-ink-900'
            : 'border-amber-700/50 bg-gray-900/85 hover:border-amber-400 hover:bg-gray-900/95'
        }`}
      >
        <HammerIcon className="size-6 max-md:size-5" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Build"
          // Grows upward from the button: anchored to its top it ran off the bottom of a
          // short viewport, taking the dev-card row with it.
          className="panel-glass pointer-events-auto absolute bottom-0 right-full mr-2 w-60 p-2 max-md:w-52"
          onMouseLeave={() => setHovered(null)}
        >
          <p className="px-1 pb-1 font-display text-[9px] font-bold uppercase tracking-[0.2em] text-amber-300/80">
            Build
          </p>
          <ul className="flex flex-col gap-1">
            {BUILDS.map((build) => {
              const Glyph = PIECE_ICON[build.id];
              const affordable = canAfford(resources, build.cost);
              const missing = missingFor(resources, build.cost);
              const outOfPieces = (piecesRemaining?.[build.id] ?? 1) <= 0;
              const deckEmpty = build.id === 'developmentCard' && deckRemaining === 0;
              const blocked = outOfPieces || deckEmpty || !canBuild;

              const note = !canBuild
                ? disabledReason
                : deckEmpty
                  ? 'The development deck is empty'
                  : outOfPieces
                    ? `No ${build.label.toLowerCase()} pieces left`
                    : affordable
                      ? build.hint
                      : 'Short - tap to ask the table for the rest';

              return (
                <li key={build.id}>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={blocked}
                    onMouseEnter={() => setHovered(build.cost)}
                    onFocus={() => setHovered(build.cost)}
                    onClick={() => {
                      setHovered(null);
                      onOpenChange(false);
                      if (affordable) onBuild(build.id);
                      else onTradeFor(missing);
                    }}
                    title={note}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition disabled:cursor-not-allowed disabled:opacity-35 ${
                      affordable
                        ? 'bg-emerald-900/30 ring-1 ring-emerald-500/40 hover:bg-emerald-800/50'
                        : 'bg-black/30 ring-1 ring-amber-900/40 hover:bg-amber-900/30'
                    }`}
                  >
                    <Glyph className="size-5 shrink-0 text-amber-200" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-xs font-bold text-parchment-50">
                        {build.label}
                      </span>
                      <CostChips cost={build.cost} resources={resources} dim={blocked} />
                    </span>
                    {!affordable && !blocked && (
                      <TradeIcon
                        className="size-4 shrink-0 text-amber-300"
                        aria-label="Ask the table for the missing cards"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
