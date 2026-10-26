const OWNER_FILL = {
  Red: 'fill-red-500',
  Blue: 'fill-blue-500',
  Orange: 'fill-orange-500',
  White: 'fill-stone-100',
};

// Small house: square body with a pitched roof, centred on the origin.
const SETTLEMENT_PATH = 'M -8 1 L -8 9 L 8 9 L 8 1 L 0 -8 Z';

// Larger building: house with a tower on the right.
const CITY_PATH = 'M -11 -1 L -11 10 L 11 10 L 11 -10 L 4 -10 L 4 -3 L -3 -3 L -3 -8 Z';

/**
 * Clickable intersection. Empty nodes are invisible until hovered; occupied nodes
 * render a settlement (house) or city (larger building) in the owner's colour.
 */
export default function NodeMarker({ node, x, y, ownerColor, onClick }) {
  const isEmpty = node.building === 'None';
  const isCity = node.building === 'City';
  const ownerFill = OWNER_FILL[ownerColor] ?? 'fill-stone-400';

  return (
    <g
      transform={`translate(${x.toFixed(3)}, ${y.toFixed(3)})`}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(node);
      }}
      className={`group outline-none ${isEmpty ? 'cursor-pointer' : 'cursor-default'}`}
      role="button"
      tabIndex={0}
      aria-label={isEmpty ? 'Empty intersection' : `${node.building} owned by ${ownerColor}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(node);
        }
      }}
    >
      {/* Generous invisible hit area so the small circle is easy to click. */}
      <circle r={14} className="fill-transparent" />

      {isEmpty ? (
        <circle
          r={7}
          className="fill-white/0 stroke-white/0 stroke-2 transition-all duration-150 group-hover:fill-white/60 group-hover:stroke-white group-focus-visible:fill-white/60 group-focus-visible:stroke-white"
        />
      ) : (
        <path
          d={isCity ? CITY_PATH : SETTLEMENT_PATH}
          strokeLinejoin="round"
          className={`${ownerFill} stroke-stone-900 stroke-2 drop-shadow`}
        />
      )}
    </g>
  );
}
