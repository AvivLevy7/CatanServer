const OWNER_FILL = {
  Red: 'fill-seat-red',
  Blue: 'fill-seat-blue',
  Orange: 'fill-seat-orange',
  White: 'fill-seat-white',
  Green: 'fill-seat-green',
};

// Small house: square body with a pitched roof, centred on the origin.
const SETTLEMENT_PATH = 'M -8 1 L -8 9 L 8 9 L 8 1 L 0 -8 Z';

// Castle: wide body with three battlements along the top.
const CITY_PATH =
  'M -12 11 L -12 -4 L -8 -4 L -8 -9 L -4 -9 L -4 -4 L -2 -4 L -2 -9 L 2 -9 L 2 -4 L 4 -4 L 4 -9 L 8 -9 L 8 -4 L 12 -4 L 12 11 Z';

/**
 * Clickable intersection. Empty nodes are invisible until hovered; occupied nodes
 * render a settlement (house) or city (castle with a gold border) in the owner's colour.
 * `upgradable` marks the current player's settlements so they read as clickable.
 */
export default function NodeMarker({ node, x, y, ownerColor, upgradable = false, onClick }) {
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
          ? 'Empty intersection'
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

      {isEmpty ? (
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
          <path
            d={isCity ? CITY_PATH : SETTLEMENT_PATH}
            strokeLinejoin="round"
            className={`${ownerFill} drop-shadow ${
              isCity ? 'stroke-amber-300 stroke-[2.5]' : 'stroke-stone-900 stroke-2'
            }`}
          />
        </>
      )}
    </g>
  );
}
