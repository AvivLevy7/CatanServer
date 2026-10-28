/**
 * Full-screen prompt shown on phones held in portrait. Pure CSS media query via
 * Tailwind's `portrait:` variant, limited to narrow screens so desktop portrait
 * monitors and large tablets are left alone.
 */
export default function RotateDeviceOverlay() {
  return (
    <div
      role="dialog"
      aria-label="Rotate your device"
      className="bg-tavern fixed inset-0 z-[100] hidden h-[100dvh] w-[100dvw] flex-col items-center justify-center gap-4 overflow-hidden p-[max(2rem,env(safe-area-inset-top))_max(2rem,env(safe-area-inset-right))_max(2rem,env(safe-area-inset-bottom))_max(2rem,env(safe-area-inset-left))] text-center text-parchment-100 portrait:max-md:flex"
    >
      <div className="relative size-24 animate-[spin_3s_ease-in-out_infinite] rounded-xl border-4 border-amber-300/80 shadow-[0_0_30px_rgba(245,190,90,0.35)]">
        <span className="absolute left-1/2 top-2 h-1 w-6 -translate-x-1/2 rounded-full bg-amber-300/80" />
      </div>
      <h2 className="font-display text-xl font-black tracking-[0.3em] text-amber-200">ROTATE DEVICE</h2>
      <p className="max-w-xs text-sm text-parchment-300">
        Catan is played in landscape. Turn your phone sideways to see the whole island.
      </p>
    </div>
  );
}
