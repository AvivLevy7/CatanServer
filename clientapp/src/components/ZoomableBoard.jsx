import { useCallback, useEffect, useRef } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { MinusIcon, PlusIcon, RecenterIcon } from './icons';

// How far the board may be pushed either way. Tight on purpose: past these the island
// either stops being readable or stops being reachable.
export const MIN_SCALE = 0.7;
export const MAX_SCALE = 2.2;

// Scale added or removed per wheel notch. The library's "smooth" mode multiplies the
// step by the raw `deltaY`, which on a normal mouse (deltaY 100) jumped most of the
// range in one flick - hence smooth off and a small fixed step: one notch, one nudge.
const WHEEL_STEP = 0.07;
const BUTTON_STEP = 0.25;

const RESET_MS = 420;
const FOCUS_MS = 520;

// An opponent's piece only pulls the camera when it lands outside this slice of the
// viewport, so ordinary play - where everyone can already see the action - is left alone.
const COMFORT_X = 0.62;
const COMFORT_Y = 0.58;

const controlButton =
  'pointer-events-auto flex size-9 items-center justify-center rounded-lg border border-amber-700/50 bg-gray-900/85 text-parchment-100 shadow-xl backdrop-blur-md transition-all hover:scale-110 hover:border-amber-400 active:scale-95 max-md:size-8';

/**
 * Pinch-to-zoom / drag-to-pan viewport for the game board. It is the full-screen
 * background of the game, so the island itself is inset (`padClass`) to keep it clear of
 * the floating HUD while the draggable surface still covers the whole viewport.
 *
 * It also owns the camera: the zoom controls, the recentre button, and the gentle pan
 * towards a piece someone else has just put down (`focus`).
 *
 * @param {{id: string|number, selector: string} | null} focus where to look, when it changes
 */
export default function ZoomableBoard({ children, padClass = '', focus = null }) {
  const api = useRef(null);
  const focusedId = useRef(null);

  const recentre = useCallback(() => {
    api.current?.resetTransform(RESET_MS, 'easeOut');
  }, []);

  // Pan (never zoom) towards a piece that has just appeared off to one side. Measuring the
  // live DOM means this works whatever the board is currently scaled or panned to, and
  // panning by a screen-space delta keeps the player's own zoom exactly as they set it.
  useEffect(() => {
    if (!focus?.selector || !focus?.id || focusedId.current === focus.id) return undefined;
    focusedId.current = focus.id;

    // One frame, so the new piece is in the DOM and has a box to measure.
    const frame = requestAnimationFrame(() => {
      const instance = api.current;
      const target = document.querySelector(focus.selector);
      if (!instance || !target) return;

      const box = target.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) return;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;

      // Comfortably in view already: leave the camera where the player put it.
      const offX = Math.abs(x / viewportWidth - 0.5) * 2;
      const offY = Math.abs(y / viewportHeight - 0.5) * 2;
      if (offX < COMFORT_X && offY < COMFORT_Y) return;

      instance.panBy(viewportWidth / 2 - x, viewportHeight / 2 - y, FOCUS_MS, 'easeOut');
    });

    return () => cancelAnimationFrame(frame);
  }, [focus?.id, focus?.selector]);

  return (
    <TransformWrapper
      ref={api}
      minScale={MIN_SCALE}
      maxScale={MAX_SCALE}
      initialScale={1}
      centerOnInit
      limitToBounds
      // Below 1x the island is smaller than the screen, so it stays centred rather than
      // drifting into a corner.
      centerZoomedOut
      doubleClick={{ mode: 'reset', animationTime: RESET_MS, animationType: 'easeOut' }}
      smooth={false}
      wheel={{ step: WHEEL_STEP }}
      pinch={{ step: 5 }}
      panning={{ velocityDisabled: true }}
    >
      <TransformComponent
        wrapperClass="!h-full !w-full"
        contentClass="!h-full !w-full flex items-center justify-center"
      >
        <div className={`flex h-full w-full items-center justify-center ${padClass}`}>{children}</div>
      </TransformComponent>

      {/* Camera rail. Inside the wrapper so it can reach the transform API, but fixed to
          the viewport so it does not pan or scale with the board. */}
      <div
        aria-label="Camera"
        className="pointer-events-none fixed left-3 top-[calc(50%+9.5rem)] z-30 flex flex-col gap-1.5 max-md:left-[max(0.375rem,env(safe-area-inset-left))] max-md:top-[calc(50%+7rem)] max-md:gap-1"
      >
        <button
          type="button"
          onClick={() => api.current?.zoomIn(BUTTON_STEP, 200, 'easeOut')}
          title="Zoom in"
          aria-label="Zoom in"
          className={controlButton}
        >
          <PlusIcon className="size-4.5 max-md:size-4" />
        </button>
        <button
          type="button"
          onClick={() => api.current?.zoomOut(BUTTON_STEP, 200, 'easeOut')}
          title="Zoom out"
          aria-label="Zoom out"
          className={controlButton}
        >
          <MinusIcon className="size-4.5 max-md:size-4" />
        </button>
        <button
          type="button"
          onClick={recentre}
          title="Recentre the board (or double-click it)"
          aria-label="Recentre the board"
          className={`${controlButton} hover:text-amber-200`}
        >
          <RecenterIcon className="size-4.5 max-md:size-4" />
        </button>
      </div>
    </TransformWrapper>
  );
}
