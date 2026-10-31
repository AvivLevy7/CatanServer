/**
 * Short puff of dust thrown up by a piece landing on the board. Pure SVG + CSS, so it
 * lives inside the board's coordinate space and scales with the zoom.
 *
 * Each particle gets its own --dx/--dy, so the single `dust-puff` keyframe in index.css
 * drives the whole burst. Particles are laid out over the upper half-circle (the dust
 * flies up and sideways, never down into the tile) and finish at opacity 0.
 */
export default function DustBurst({ count = 7, radius = 17, className = 'fill-amber-50/70' }) {
  return (
    <g className="pointer-events-none" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        // Fan the particles across 200 degrees of the upward arc, with a deterministic
        // jitter per index so the burst looks scattered but never re-rolls on re-render.
        const angle = ((-190 + (i * 200) / Math.max(1, count - 1)) * Math.PI) / 180;
        const reach = radius * (0.6 + (((i * 37) % 11) / 11) * 0.7);
        return (
          <circle
            key={i}
            r={1.8 + (((i * 13) % 5) / 5) * 1.6}
            className={`animate-dust ${className}`}
            style={{
              '--dx': `${(Math.cos(angle) * reach).toFixed(2)}px`,
              '--dy': `${(Math.sin(angle) * reach).toFixed(2)}px`,
              animationDelay: `${i * 26}ms`,
            }}
          />
        );
      })}
    </g>
  );
}
