import { HEX_SIZE, HEX_POINTS, hexCenter } from '../hexGeometry';

export { HEX_SIZE, HEX_WIDTH, VERTICAL_STEP } from '../hexGeometry';

const POINTS = HEX_POINTS;

const TERRAIN_FILL = {
  Forest: 'fill-catan-forest',
  Pasture: 'fill-catan-pasture',
  Fields: 'fill-catan-fields',
  Hills: 'fill-catan-hills',
  Mountains: 'fill-catan-mountains',
  Desert: 'fill-catan-desert',
};

export default function HexTile({ tile, isSelected, onSelect }) {
  const { type, numberToken, hasRobber } = tile;

  const { x, y } = hexCenter(tile);

  // 6 and 8 are the highest-probability rolls and are traditionally printed in red.
  const isHighProbability = numberToken === 6 || numberToken === 8;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={() => onSelect?.(tile)}
      className="group cursor-pointer outline-none"
      role="button"
      tabIndex={0}
      aria-label={`${type}${numberToken ? `, token ${numberToken}` : ''}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(tile);
        }
      }}
    >
      {/* transform-box:fill-box makes origin-center resolve against the shape, not the SVG root. */}
      <polygon
        points={POINTS}
        className={`${TERRAIN_FILL[type] ?? 'fill-slate-400'} [transform-box:fill-box] origin-center stroke-amber-950/70 stroke-2 transition-all duration-200 ease-out group-hover:scale-105 group-hover:brightness-115 group-focus-visible:brightness-115 ${
          isSelected ? 'stroke-[5] stroke-white brightness-110' : ''
        }`}
      />

      {numberToken != null && (
        <g className="pointer-events-none">
          <circle
            r={HEX_SIZE * 0.29}
            className="fill-amber-50 stroke-amber-950/40 stroke-1 drop-shadow"
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            className={`select-none text-[1.7rem] font-bold ${
              isHighProbability ? 'fill-red-700' : 'fill-stone-800'
            }`}
          >
            {numberToken}
          </text>
        </g>
      )}

      {hasRobber && (
        <circle
          cy={HEX_SIZE * 0.08}
          r={HEX_SIZE * 0.2}
          className="pointer-events-none fill-stone-900/85"
        />
      )}
    </g>
  );
}
