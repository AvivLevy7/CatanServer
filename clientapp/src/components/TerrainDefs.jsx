/**
 * Inline SVG textures for each terrain type. Rendered once inside <defs>; every hex
 * fills with url(#terrain-<Type>). Pure vector so there are no external assets to load.
 */
const TILE = 40;

function Forest() {
  const tree = (x, y, s = 1) => (
    <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-1.2" y="4" width="2.4" height="5" fill="#3f2a14" />
      <polygon points="0,-9 6,2 -6,2" fill="#1f6b32" />
      <polygon points="0,-4 5,5 -5,5" fill="#277a3b" />
      <polygon points="0,-7 3.5,-1 -3.5,-1" fill="#3c9a4f" opacity="0.6" />
    </g>
  );
  return (
    <pattern id="terrain-Forest" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
      <rect width={TILE} height={TILE} fill="#1b4d2a" />
      <rect width={TILE} height={TILE} fill="url(#terrain-grain)" opacity="0.5" />
      {tree(8, 10)}
      {tree(28, 8, 0.8)}
      {tree(18, 26, 1.1)}
      {tree(36, 30, 0.7)}
    </pattern>
  );
}

function Pasture() {
  const sheep = (x, y, s = 1) => (
    <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="0" rx="5" ry="3.4" fill="#f5f0e6" />
      <circle cx="-2.5" cy="-1.5" r="2" fill="#f5f0e6" />
      <circle cx="2.5" cy="-1.8" r="2.2" fill="#f5f0e6" />
      <circle cx="5" cy="0.2" r="1.6" fill="#2b2b2b" />
      <rect x="-3" y="2.5" width="1" height="2.2" fill="#2b2b2b" />
      <rect x="1.5" y="2.5" width="1" height="2.2" fill="#2b2b2b" />
    </g>
  );
  return (
    <pattern id="terrain-Pasture" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
      <rect width={TILE} height={TILE} fill="#5e9c3a" />
      <rect width={TILE} height={TILE} fill="url(#terrain-grain)" opacity="0.5" />
      <path d="M3 32 q2 -4 4 0 M15 36 q2 -4 4 0 M30 14 q2 -4 4 0 M8 6 q2 -4 4 0" stroke="#4a8130" strokeWidth="1.2" fill="none" />
      {sheep(12, 16)}
      {sheep(30, 30, 0.85)}
    </pattern>
  );
}

function Fields() {
  const wheat = (x, y) => (
    <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
      <line x1="0" y1="0" x2="0" y2="12" stroke="#a36a12" strokeWidth="1.2" />
      {[0, 2.5, 5].map((d) => (
        <g key={d}>
          <ellipse cx="-1.8" cy={d} rx="1.4" ry="2" fill="#f0c33c" transform={`rotate(-25 -1.8 ${d})`} />
          <ellipse cx="1.8" cy={d} rx="1.4" ry="2" fill="#f0c33c" transform={`rotate(25 1.8 ${d})`} />
        </g>
      ))}
    </g>
  );
  return (
    <pattern id="terrain-Fields" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
      <rect width={TILE} height={TILE} fill="#d9a526" />
      <rect width={TILE} height={TILE} fill="url(#terrain-grain)" opacity="0.6" />
      {wheat(6, 4)}
      {wheat(16, 20)}
      {wheat(27, 6)}
      {wheat(35, 24)}
    </pattern>
  );
}

function Hills() {
  return (
    <pattern id="terrain-Hills" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
      <rect width={TILE} height={TILE} fill="#a8472a" />
      <rect width={TILE} height={TILE} fill="url(#terrain-grain)" opacity="0.5" />
      {/* Brick courses */}
      {[0, 10, 20, 30].map((y, i) => (
        <g key={y}>
          <line x1="0" y1={y} x2={TILE} y2={y} stroke="#7a2f18" strokeWidth="1.4" />
          {[0, 20].map((x) => (
            <line key={x} x1={x + (i % 2 ? 10 : 0)} y1={y} x2={x + (i % 2 ? 10 : 0)} y2={y + 10} stroke="#7a2f18" strokeWidth="1.4" />
          ))}
        </g>
      ))}
      <rect x="2" y="2" width="16" height="6" fill="#c25a35" opacity="0.5" />
      <rect x="22" y="12" width="16" height="6" fill="#c25a35" opacity="0.5" />
    </pattern>
  );
}

function Mountains() {
  const peak = (x, y, s = 1) => (
    <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${s})`}>
      <polygon points="0,-10 9,6 -9,6" fill="#5a6270" />
      <polygon points="0,-10 9,6 0,6" fill="#4a515d" />
      <polygon points="0,-10 3,-4.5 -3,-4.5" fill="#eef2f7" />
    </g>
  );
  return (
    <pattern id="terrain-Mountains" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
      <rect width={TILE} height={TILE} fill="#6b7482" />
      <rect width={TILE} height={TILE} fill="url(#terrain-grain)" opacity="0.5" />
      {peak(10, 14)}
      {peak(30, 12, 0.8)}
      {peak(20, 32, 1.1)}
    </pattern>
  );
}

function Desert() {
  return (
    <pattern id="terrain-Desert" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
      <rect width={TILE} height={TILE} fill="#e2c48a" />
      <rect width={TILE} height={TILE} fill="url(#terrain-grain)" opacity="0.6" />
      <path d="M0 10 q10 -4 20 0 t20 0 M0 28 q10 -4 20 0 t20 0" stroke="#c9a567" strokeWidth="1.2" fill="none" />
      <g transform="translate(28 20)">
        <rect x="-1" y="-6" width="2" height="12" fill="#5b8a3c" rx="1" />
        <rect x="-5" y="-3" width="2" height="6" fill="#5b8a3c" rx="1" />
        <rect x="3" y="-4" width="2" height="6" fill="#5b8a3c" rx="1" />
        <rect x="-5" y="-1" width="4" height="2" fill="#5b8a3c" />
        <rect x="1" y="-2" width="4" height="2" fill="#5b8a3c" />
      </g>
    </pattern>
  );
}

export default function TerrainDefs() {
  return (
    <defs>
      {/* Subtle noise overlay reused by every terrain for a painted, non-flat look. */}
      <filter id="terrain-noise" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0" />
      </filter>
      <pattern id="terrain-grain" width="64" height="64" patternUnits="userSpaceOnUse">
        <rect width="64" height="64" fill="#000" filter="url(#terrain-noise)" />
      </pattern>
      {/* Soft inner vignette so each tile reads as a raised piece. */}
      <radialGradient id="terrain-vignette" cx="50%" cy="45%" r="65%">
        <stop offset="60%" stopColor="#000" stopOpacity="0" />
        <stop offset="100%" stopColor="#000" stopOpacity="0.35" />
      </radialGradient>
      <radialGradient id="token-face" cx="40%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#fffaf0" />
        <stop offset="100%" stopColor="#e9d8b4" />
      </radialGradient>
      <filter id="soft-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.5" />
      </filter>
      <Forest />
      <Pasture />
      <Fields />
      <Hills />
      <Mountains />
      <Desert />
    </defs>
  );
}
