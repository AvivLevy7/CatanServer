/**
 * Dark red closing in from the edges of the screen when a 7 comes up, with the single
 * word that explains it. Keyed on the roll so each 7 replays the animation from the top;
 * it sits above the board but below the dice cinematic, and never takes a pointer event.
 */
export default function SevenVignette({ pulseKey }) {
  if (!pulseKey) return null;

  return (
    <div
      key={pulseKey}
      role="alert"
      aria-label="A seven was rolled. The robber is on the move."
      className="animate-seven-vignette pointer-events-none fixed inset-0 z-[42] flex items-start justify-center overflow-hidden"
    >
      <span className="mt-[18vh] font-display text-[clamp(1.1rem,5vw,2.2rem)] font-black uppercase tracking-[0.4em] text-rose-100/90 [text-shadow:0_0_24px_rgba(190,18,60,0.95),0_2px_8px_rgba(0,0,0,0.9)]">
        Seven
      </span>
    </div>
  );
}
