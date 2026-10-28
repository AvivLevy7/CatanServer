import { HEX_SIZE, HEX_POINTS, hexCenter } from '../hexGeometry';

export { HEX_SIZE, HEX_WIDTH, VERTICAL_STEP } from '../hexGeometry';

const POINTS = HEX_POINTS;

const TERRAIN_TYPES = new Set(['Forest', 'Pasture', 'Fields', 'Hills', 'Mountains', 'Desert']);

// Pips below the number mirror the physical tokens (probability out of 36).
const PIPS = { 2: 1, 12: 1, 3: 2, 11: 2, 4: 3, 10: 3, 5: 4, 9: 4, 6: 5, 8: 5 };

export default function HexTile({ tile, isSelected, onSelect, robberMode = false }) {
  const { type, numberToken, hasRobber } = tile;

  const { x, y } = hexCenter(tile);

  // 6 and 8 are the highest-probability rolls and are traditionally printed in red.
  const isHighProbability = numberToken === 6 || numberToken === 8;

  // In robber mode the current robber tile is not a valid destination.
  const isRobberTarget = robberMode && !hasRobber;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={() => onSelect?.(tile)}
      className={`group outline-none ${
        robberMode ? (isRobberTarget ? 'cursor-crosshair' : 'cursor-not-allowed') : 'cursor-pointer'
      }`}
      role="button"
      tabIndex={0}
      aria-label={`${type}${numberToken ? `, token ${numberToken}` : ''}${hasRobber ? ', robber here' : ''}${
        isRobberTarget ? ', click to move robber here' : ''
      }`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(tile);
        }
      }}
    >
      {/* transform-box:fill-box makes origin-center resolve against the shape, not the SVG root. */}
      <g
        className={`[transform-box:fill-box] origin-center transition-all duration-200 ease-out group-hover:scale-105 group-hover:brightness-115 group-focus-visible:brightness-115 ${
          isSelected ? 'brightness-110' : ''
        }`}
      >
        <polygon
          points={POINTS}
          fill={TERRAIN_TYPES.has(type) ? `url(#terrain-${type})` : '#94a3b8'}
          className="stroke-amber-950/80 stroke-2"
        />
        <polygon points={POINTS} fill="url(#terrain-vignette)" className="pointer-events-none" />
        <polygon
          points={POINTS}
          fill="none"
          className={`pointer-events-none transition-all duration-200 ${
            isSelected
              ? 'stroke-[5] stroke-amber-100 drop-shadow-[0_0_6px_rgba(253,230,138,0.9)]'
              : 'stroke-amber-200/25 stroke-1'
          } ${isRobberTarget ? 'group-hover:stroke-[5] group-hover:stroke-rose-200' : ''}`}
        />
      </g>

      {numberToken != null && (
        <g className="pointer-events-none" filter="url(#soft-shadow)">
          <circle r={HEX_SIZE * 0.3} fill="url(#token-face)" className="stroke-amber-900/70 stroke-[1.5]" />
          <circle r={HEX_SIZE * 0.25} fill="none" className="stroke-amber-800/30 stroke-1" />
          <text
            y={-2}
            textAnchor="middle"
            dominantBaseline="central"
            className={`select-none font-display text-[1.55rem] font-bold ${
              isHighProbability ? 'fill-red-700' : 'fill-stone-800'
            }`}
          >
            {numberToken}
          </text>
          <g transform={`translate(0 ${HEX_SIZE * 0.17})`}>
            {Array.from({ length: PIPS[numberToken] ?? 0 }).map((_, i, arr) => (
              <circle
                key={i}
                cx={(i - (arr.length - 1) / 2) * 4}
                r="1.3"
                className={isHighProbability ? 'fill-red-700' : 'fill-stone-700'}
              />
            ))}
          </g>
        </g>
      )}

      {hasRobber && (
        <g className="pointer-events-none" transform={`translate(0, ${HEX_SIZE * 0.5})`} filter="url(#soft-shadow)">
          <ellipse cy={HEX_SIZE * 0.13} rx={HEX_SIZE * 0.2} ry={HEX_SIZE * 0.06} className="fill-black/40" />
          <path
            d={`M ${-HEX_SIZE * 0.17} ${HEX_SIZE * 0.12} Q ${-HEX_SIZE * 0.19} ${-HEX_SIZE * 0.08} 0 ${-HEX_SIZE * 0.1} Q ${HEX_SIZE * 0.19} ${-HEX_SIZE * 0.08} ${HEX_SIZE * 0.17} ${HEX_SIZE * 0.12} Z`}
            className="fill-stone-900 stroke-stone-300/70 stroke-1"
          />
          <circle cy={-HEX_SIZE * 0.16} r={HEX_SIZE * 0.09} className="fill-stone-900 stroke-stone-300/70 stroke-1" />
        </g>
      )}
    </g>
  );
}
