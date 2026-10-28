const OWNER_STROKE = {
  Red: 'stroke-seat-red',
  Blue: 'stroke-seat-blue',
  Orange: 'stroke-seat-orange',
  White: 'stroke-seat-white',
  Green: 'stroke-seat-green',
};

/**
 * Clickable path between two intersections. Drawn slightly shorter than the hex
 * side so adjacent roads never overlap the node markers at either end.
 */
export default function EdgeMarker({ edge, from, to, ownerColor, highlighted = false, onClick }) {
  const hasRoad = edge.ownerId != null;

  // Trim 18% from each end so roads stop short of the corner markers.
  const trim = 0.18;
  const x1 = from.x + (to.x - from.x) * trim;
  const y1 = from.y + (to.y - from.y) * trim;
  const x2 = to.x - (to.x - from.x) * trim;
  const y2 = to.y - (to.y - from.y) * trim;

  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(edge);
      }}
      className="group cursor-pointer outline-none"
      role="button"
      tabIndex={0}
      aria-label={hasRoad ? `Road owned by ${ownerColor}` : 'Empty path'}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(edge);
        }
      }}
    >
      {/* Wide invisible hit area. */}
      <line x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-transparent stroke-[14]" strokeLinecap="round" />

      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        strokeLinecap="round"
        className={
          hasRoad
            ? `${OWNER_STROKE[ownerColor] ?? 'stroke-stone-400'} stroke-[7] drop-shadow`
            : highlighted
              ? 'animate-pulse stroke-amber-200 stroke-[6] group-hover:stroke-white'
              : 'stroke-white/0 stroke-[6] transition-all duration-150 group-hover:stroke-white/60 group-focus-visible:stroke-white/60'
        }
      />
    </g>
  );
}
