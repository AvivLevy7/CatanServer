import { HEX_SIZE } from '../hexGeometry';

// Server HarborType -> label and colour.
const HARBORS = {
  Generic: { label: '3:1', fill: '#e7e5e4', text: '#1c1917' },
  Brick: { label: '2:1', sub: 'BR', fill: '#b91c1c', text: '#fef2f2' },
  Lumber: { label: '2:1', sub: 'WD', fill: '#15803d', text: '#f0fdf4' },
  Grain: { label: '2:1', sub: 'WH', fill: '#eab308', text: '#422006' },
  Wool: { label: '2:1', sub: 'SH', fill: '#bef264', text: '#1a2e05' },
  Ore: { label: '2:1', sub: 'OR', fill: '#64748b', text: '#f8fafc' },
};

// How far beyond the coast edge the port badge sits.
const OFFSET = HEX_SIZE * 0.55;

/**
 * One port badge per harbour edge, placed just off the coast on the seaward side,
 * with thin piers back to the two intersections it serves.
 */
export default function PortMarker({ harbor, from, to, seaward }) {
  const style = HARBORS[harbor];
  if (!style) return null;

  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const len = Math.hypot(seaward.x, seaward.y) || 1;
  const cx = mid.x + (seaward.x / len) * OFFSET;
  const cy = mid.y + (seaward.y / len) * OFFSET;

  return (
    <g aria-label={`${harbor} port`} pointerEvents="none">
      <line x1={from.x} y1={from.y} x2={cx} y2={cy} stroke={style.fill} strokeWidth="2" strokeDasharray="3 3" opacity="0.8" />
      <line x1={to.x} y1={to.y} x2={cx} y2={cy} stroke={style.fill} strokeWidth="2" strokeDasharray="3 3" opacity="0.8" />
      <circle cx={cx} cy={cy} r={HEX_SIZE * 0.26} fill={style.fill} stroke="#0c4a6e" strokeWidth="1.5" />
      <text
        x={cx}
        y={style.sub ? cy - 2 : cy + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={style.sub ? 10 : 12}
        fontWeight="700"
        fill={style.text}
      >
        {style.label}
      </text>
      {style.sub && (
        <text x={cx} y={cy + 9} textAnchor="middle" dominantBaseline="middle" fontSize="8" fontWeight="700" fill={style.text}>
          {style.sub}
        </text>
      )}
    </g>
  );
}
