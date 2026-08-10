// Pointy-top hexagon geometry.
// Pointy-top hexagon geometry.
// For circumradius `size`: width = sqrt(3) * size, height = 2 * size.
// Rows overlap vertically by 1/4 height, so vertical step = 1.5 * size.
export const HEX_SIZE = 60;
export const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
export const VERTICAL_STEP = 1.5 * HEX_SIZE;

// Corner points starting at the north vertex, going clockwise.
const POINTS = Array.from({ length: 6 }, (_, i) => {
  const angle = (Math.PI / 180) * (60 * i - 90);
  return `${(HEX_SIZE * Math.cos(angle)).toFixed(3)},${(HEX_SIZE * Math.sin(angle)).toFixed(3)}`;
}).join(' ');

const TERRAIN_FILL = {
  Forest: 'fill-catan-forest',
  Pasture: 'fill-catan-pasture',
  Fields: 'fill-catan-fields',
  Hills: 'fill-catan-hills',
  Mountains: 'fill-catan-mountains',
  Desert: 'fill-catan-desert',
};

export default function HexTile({ tile, isSelected, onSelect }) {
  const { row, col, rowLength, type, numberToken, hasRobber } = tile;

  // Centre each row horizontally: rows of 3 are inset more than rows of 5.
  const maxRowLength = 5;
  const rowOffset = ((maxRowLength - rowLength) * HEX_WIDTH) / 2;
  const x = rowOffset + col * HEX_WIDTH + HEX_WIDTH / 2;
  const y = row * VERTICAL_STEP + HEX_SIZE;

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
