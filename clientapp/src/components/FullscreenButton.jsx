import { useEffect, useState } from 'react';
import { FullscreenEnterIcon, FullscreenExitIcon } from './icons';

const root = () => document.documentElement;

const fullscreenElement = () =>
  document.fullscreenElement ?? document.webkitFullscreenElement ?? null;

const supported = () =>
  typeof document !== 'undefined' &&
  !!(root().requestFullscreen || root().webkitRequestFullscreen);

/**
 * Toggles native browser full-screen so the URL bar and chrome get out of the way.
 * Renders nothing where the API is unavailable (notably iOS Safari, which only allows
 * full-screen on video elements) rather than offering a button that cannot work.
 */
export default function FullscreenButton({ className = '' }) {
  const [isFullscreen, setIsFullscreen] = useState(() => !!fullscreenElement());
  const [available] = useState(supported);

  useEffect(() => {
    const sync = () => setIsFullscreen(!!fullscreenElement());
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  if (!available) return null;

  const toggle = () => {
    const el = root();
    if (fullscreenElement()) {
      const exit = document.exitFullscreen ?? document.webkitExitFullscreen;
      Promise.resolve(exit?.call(document)).catch(() => {});
      return;
    }
    const enter = el.requestFullscreen ?? el.webkitRequestFullscreen;
    // `navigationUI: 'hide'` is ignored where unsupported, so one call covers both.
    Promise.resolve(enter?.call(el, { navigationUI: 'hide' })).catch(() => {});
  };

  const label = isFullscreen ? 'Exit full screen' : 'Play full screen';
  const Glyph = isFullscreen ? FullscreenExitIcon : FullscreenEnterIcon;

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      aria-pressed={isFullscreen}
      className={`pointer-events-auto flex size-9 items-center justify-center rounded-lg border border-amber-700/50 bg-gray-900/85 text-parchment-100 shadow-xl backdrop-blur-md transition-all hover:scale-110 hover:border-amber-400 max-md:size-8 ${className}`}
    >
      <Glyph className="size-4.5 max-md:size-4" />
    </button>
  );
}
