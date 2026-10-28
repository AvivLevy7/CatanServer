import { HEX_SIZE } from '../hexGeometry';

// Server HarborType -> badge colours and the icon drawn inside the shield.
const HARBORS = {
  Generic: { label: '3:1', ring: '#e7d8b1', fill: '#2a2320', ink: '#f5ecd7' },
  Brick: { label: '2:1', ring: '#f1b9a3', fill: '#8a2f1a', ink: '#fff1ea' },
  Lumber: { label: '2:1', ring: '#b7e3b4', fill: '#1f5b2e', ink: '#eefbea' },
  Grain: { label: '2:1', ring: '#fde68a', fill: '#9a6a0b', ink: '#fff8dc' },
  Wool: { label: '2:1', ring: '#e8f5c7', fill: '#4f7a2a', ink: '#f7fde9' },
  Ore: { label: '2:1', ring: '#cbd5e1', fill: '#3b4453', ink: '#f1f5f9' },
};

// How far beyond the coast edge the port badge sits.
const OFFSET = HEX_SIZE * 0.62;
const R = HEX_SIZE * 0.3;

/** Shield outline centred on the origin with "radius" r. */
const shieldPath = (r) =>
  `M ${-r} ${-r * 0.75} Q ${-r} ${-r} ${-r * 0.75} ${-r} L ${r * 0.75} ${-r} Q ${r} ${-r} ${r} ${-r * 0.75} L ${r} ${r * 0.15} Q ${r} ${r * 0.8} 0 ${r * 1.1} Q ${-r} ${r * 0.8} ${-r} ${r * 0.15} Z`;

/** Tiny vector glyph for each resource, drawn in a ~10px box. */
function Icon({ harbor, ink }) {
  switch (harbor) {
    case 'Brick':
      return (
        <g fill={ink}>
          <rect x="-7" y="-4" width="6" height="3.5" rx="0.5" />
          <rect x="1" y="-4" width="6" height="3.5" rx="0.5" />
          <rect x="-3" y="0.5" width="6" height="3.5" rx="0.5" />
        </g>
      );
    case 'Lumber':
      return (
        <g>
          <polygon points="0,-7 6,1 -6,1" fill={ink} />
          <polygon points="0,-3 5,4 -5,4" fill={ink} />
          <rect x="-1.2" y="4" width="2.4" height="3" fill={ink} />
        </g>
      );
    case 'Grain':
      return (
        <g fill={ink}>
          <rect x="-0.6" y="-2" width="1.2" height="9" />
          {[-5, -2, 1].map((y) => (
            <g key={y}>
              <ellipse cx="-2" cy={y} rx="1.6" ry="2.2" transform={`rotate(-25 -2 ${y})`} />
              <ellipse cx="2" cy={y} rx="1.6" ry="2.2" transform={`rotate(25 2 ${y})`} />
            </g>
          ))}
        </g>
      );
    case 'Wool':
      return (
        <g fill={ink}>
          <ellipse cx="0" cy="0" rx="6" ry="4" />
          <circle cx="-3" cy="-2" r="2.4" />
          <circle cx="3" cy="-2.3" r="2.6" />
          <circle cx="6" cy="0.5" r="1.9" fill="#1c1917" />
          <rect x="-3.5" y="3" width="1.3" height="2.8" fill="#1c1917" />
          <rect x="1.8" y="3" width="1.3" height="2.8" fill="#1c1917" />
        </g>
      );
    case 'Ore':
      return (
        <g>
          <polygon points="-8,5 -3,-5 1,2 4,-3 8,5" fill={ink} />
          <polygon points="-3,-5 -1.5,-2 -4.5,-2" fill="#1c1917" opacity="0.6" />
        </g>
      );
    default:
      return (
        <text textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="800" fill={ink} fontFamily="Cinzel, serif">
          3:1
        </text>
      );
  }
}

/**
 * One shield badge per harbour edge, placed just off the coast on the seaward side,
 * with rope piers back to the two intersections it serves.
 */
export default function PortMarker({ harbor, from, to, seaward }) {
  const style = HARBORS[harbor];
  if (!style) return null;

  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const len = Math.hypot(seaward.x, seaward.y) || 1;
  const cx = mid.x + (seaward.x / len) * OFFSET;
  const cy = mid.y + (seaward.y / len) * OFFSET;
  const isGeneric = harbor === 'Generic';

  return (
    <g aria-label={`${harbor} port`} pointerEvents="none">
      {/* Piers */}
      {[from, to].map((p, i) => (
        <g key={i}>
          <line x1={p.x} y1={p.y} x2={cx} y2={cy} stroke="#1c1917" strokeWidth="4" strokeLinecap="round" opacity="0.45" />
          <line x1={p.x} y1={p.y} x2={cx} y2={cy} stroke="#c8a462" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />
        </g>
      ))}

      <g transform={`translate(${cx} ${cy})`} filter="url(#soft-shadow)">
        <path d={shieldPath(R + 2)} fill={style.ring} />
        <path d={shieldPath(R)} fill={style.fill} stroke="#1c1917" strokeWidth="0.8" />
        <path d={shieldPath(R - 3)} fill="none" stroke={style.ring} strokeWidth="0.8" opacity="0.6" />

        {isGeneric ? (
          <Icon harbor={harbor} ink={style.ink} />
        ) : (
          <>
            <g transform="translate(0 -3) scale(0.9)">
              <Icon harbor={harbor} ink={style.ink} />
            </g>
            <text
              y={R * 0.55}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="7.5"
              fontWeight="800"
              fill={style.ring}
              fontFamily="Cinzel, serif"
            >
              {style.label}
            </text>
          </>
        )}
      </g>
    </g>
  );
}
