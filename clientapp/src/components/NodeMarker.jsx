import DustBurst from './DustBurst';

const OWNER_FILL = {
  Red: 'fill-seat-red',
  Blue: 'fill-seat-blue',
  Orange: 'fill-seat-orange',
  White: 'fill-seat-white',
  Green: 'fill-seat-green',
};

// Small house: square body with a pitched roof, centred on the origin.
const SETTLEMENT_PATH = 'M -8 1 L -8 9 L 8 9 L 8 1 L 0 -8 Z';

/**
 * Colour ramp for an intersection's total pips. A corner on three good numbers tops out
 * around 12-13 pips; 5 or less is a poor spot. Bands rather than a gradient, so the
 * difference between a good and a great corner is visible at a glance.
 */
const PIP_FILL = (pips) =>
  pips >= 11
    ? 'fill-amber-300/95'
    : pips >= 9
      ? 'fill-amber-200/85'
      : pips >= 7
        ? 'fill-parchment-200/75'
        : pips >= 5
          ? 'fill-stone-300/60'
          : 'fill-stone-400/45';

// Castle: wide body with three battlements along the top.
const CITY_PATH =
  'M -12 11 L -12 -4 L -8 -4 L -8 -9 L -4 -9 L -4 -4 L -2 -4 L -2 -9 L 2 -9 L 2 -4 L 4 -4 L 4 -9 L 8 -9 L 8 -4 L 12 -4 L 12 11 Z';

/**
 * Clickable intersection. Empty nodes are invisible until hovered; occupied nodes
 * render a settlement (house) or city (castle with a gold border) in the owner's colour.
 * `upgradable` marks the current player's settlements so they read as clickable.
 * `justPlaced` runs the drop-and-dust impact once, right after the server confirms the
 * build - it is keyed off the state change, so every seat at the table sees it.
 */
export default function NodeMarker({
  node,
  x,
  y,
  ownerColor,
  upgradable = false,
  justPlaced = false,
  // Total dice pips of the hexes this intersection touches, shown during setup only.
  pips = null,
  onClick,
}) {
  const isEmpty = node.building === 'None';
  const isCity = node.building === 'City';
  const ownerFill = OWNER_FILL[ownerColor] ?? 'fill-stone-400';
  const interactive = isEmpty || upgradable;

  return (
    <g
      transform={`translate(${x.toFixed(3)}, ${y.toFixed(3)})`}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(node);
      }}
      className={`group outline-none ${interactive ? 'cursor-pointer' : 'cursor-default'}`}
      role="button"
      tabIndex={0}
      aria-label={
        (isEmpty
          ? `Empty intersection${pips != null ? `, ${pips} pips` : ''}`
          : `${node.building} owned by ${ownerColor}${upgradable ? ', click to upgrade to a city' : ''}`) +
        (node.harbor && node.harbor !== 'None'
          ? ` (${node.harbor === 'Generic' ? '3:1' : `2:1 ${node.harbor}`} port)`
          : '')
      }
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(node);
        }
      }}
    >
      {/* Generous invisible hit area so the small circle is easy to click. */}
      <circle r={14} className="fill-transparent" />

      {isEmpty && pips != null ? (
        // Setup only: how much production this corner is actually worth, as the total pips
        // of its hexes. Warmer and larger the better the spot, so the board can be read at
        // a glance instead of counted token by token.
        <g className="animate-pip-in pointer-events-none">
          <circle
            r={9.5}
            className={`${PIP_FILL(pips)} stroke-black/40 stroke-[0.75] transition-all duration-150 group-hover:stroke-white`}
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            y={0.5}
            className={`select-none font-display text-[9px] font-black ${pips >= 10 ? 'fill-amber-950' : 'fill-stone-900'}`}
          >
            {pips}
          </text>
        </g>
      ) : isEmpty ? (
        <circle
          r={7}
          className="fill-white/0 stroke-white/0 stroke-2 transition-all duration-150 group-hover:fill-white/60 group-hover:stroke-white group-focus-visible:fill-white/60 group-focus-visible:stroke-white"
        />
      ) : (
        <>
          {upgradable && (
            <circle
              r={15}
              className="fill-transparent stroke-white/0 stroke-2 transition-all duration-150 group-hover:stroke-white/80 group-focus-visible:stroke-white/80"
            />
          )}
          <g className={justPlaced ? 'animate-piece-drop' : undefined}>
            <path
              d={isCity ? CITY_PATH : SETTLEMENT_PATH}
              strokeLinejoin="round"
              className={`${ownerFill} drop-shadow ${
                isCity ? 'stroke-amber-300 stroke-[2.5]' : 'stroke-stone-900 stroke-2'
              }`}
            />
          </g>
          {justPlaced && <DustBurst radius={isCity ? 24 : 18} count={isCity ? 9 : 7} />}
        </>
      )}
    </g>
  );
}
