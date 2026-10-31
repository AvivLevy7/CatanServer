import { useEffect, useState } from 'react';
import { RESOURCE_STYLE } from '../theme';
import { RESOURCES } from '../resources';

// One icon's travel time, and the gap between consecutive icons leaving the island.
const FLIGHT_MS = 760;
const STAGGER_MS = 55;
const ICON_PX = 28;

/** Viewport centre of the first element matching `selector`, or null if it is not on screen. */
function centreOf(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  const box = el.getBoundingClientRect();
  if (box.width === 0 && box.height === 0) return null;
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/**
 * Resource icons flying from the hexes that produced them to whoever collected them.
 *
 * Positions are measured from the live DOM rather than computed, which keeps the flights
 * correct whatever the board is zoomed or panned to: hexes publish `data-hex-id`, seat
 * chips publish `data-player-id`, and the viewer's own hand publishes `data-resource-hand`.
 *
 * Each icon is two nested elements with different easings - the outer carries the
 * horizontal move, the inner the vertical - so the icon travels along a curve instead of
 * a straight line.
 *
 * @param {{id: number, flights: Array}} burst one roll's payout; a new `id` starts a new run
 * @param {Function} onDone called once the last icon has landed
 */
export default function FlyingResources({ burst, onDone }) {
  const [run, setRun] = useState(null);

  useEffect(() => {
    if (!burst?.flights?.length) return undefined;

    let launchFrame = 0;
    let paintFrame = 0;

    // Measured after the next paint, not during the effect: the board may have only just
    // re-rendered, and reading layout mid-effect would also mean setting state
    // synchronously inside it.
    const measureFrame = requestAnimationFrame(() => {
      // Anything whose endpoints are not on screen (a seat chip scrolled out of the top
      // bar, say) is simply skipped.
      const measured = [];
      for (const flight of burst.flights) {
        const from = centreOf(`[data-hex-id="${flight.hexId}"]`);
        const to = flight.isMe
          ? centreOf('[data-resource-hand]') ?? centreOf(`[data-player-id="${flight.playerId}"]`)
          : centreOf(`[data-player-id="${flight.playerId}"]`);
        if (!from || !to) continue;
        measured.push({ ...flight, from, to });
      }

      if (measured.length === 0) {
        onDone?.();
        return;
      }

      setRun({ id: burst.id, flights: measured, launched: false });

      // Two more frames: the icons have to be painted at their source before the
      // transition to the target will animate rather than jump.
      launchFrame = requestAnimationFrame(() => {
        paintFrame = requestAnimationFrame(() =>
          setRun((current) => (current?.id === burst.id ? { ...current, launched: true } : current)),
        );
      });
    });

    const finish = setTimeout(
      () => {
        setRun(null);
        onDone?.();
      },
      FLIGHT_MS + STAGGER_MS * burst.flights.length + 320,
    );

    return () => {
      cancelAnimationFrame(measureFrame);
      cancelAnimationFrame(launchFrame);
      cancelAnimationFrame(paintFrame);
      clearTimeout(finish);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burst?.id]);

  if (!run) return null;

  return (
    <div aria-hidden="true">
      {run.flights.map((flight, i) => {
        const style = RESOURCE_STYLE[flight.resource];
        if (!style) return null;
        const target = run.launched ? flight.to : flight.from;
        const delay = `${i * STAGGER_MS}ms`;

        return (
          <div
            key={flight.key}
            className="resource-flight"
            style={{
              // Horizontal leg: eases out of the hex and into the avatar.
              transform: `translate3d(${(target.x - ICON_PX / 2).toFixed(1)}px, ${(
                flight.from.y - ICON_PX / 2
              ).toFixed(1)}px, 0)`,
              transitionProperty: 'transform, opacity',
              transitionDuration: `${FLIGHT_MS}ms, 200ms`,
              transitionTimingFunction: 'cubic-bezier(0.45, 0.05, 0.55, 0.95), ease-in',
              transitionDelay: `${delay}, ${FLIGHT_MS - 160 + i * STAGGER_MS}ms`,
              opacity: run.launched ? 0 : 1,
            }}
          >
            {/* Vertical leg on its own easing, which bends the path into an arc. */}
            <div
              style={{
                transform: `translate3d(0, ${(target.y - flight.from.y).toFixed(1)}px, 0) scale(${
                  run.launched ? 0.72 : 1
                })`,
                transition: `transform ${FLIGHT_MS}ms cubic-bezier(0.7, 0, 0.9, 0.5) ${delay}`,
              }}
            >
              <span
                title={`${flight.resource} to ${flight.playerName ?? 'a player'}`}
                className={`flex size-7 items-center justify-center rounded-md bg-gradient-to-b text-base leading-none shadow-[0_2px_8px_rgba(0,0,0,0.6)] ring-1 ring-black/40 ${style.card} ${style.ink}`}
              >
                <span>{style.glyph}</span>
                <span className="sr-only">
                  {RESOURCES.find((r) => r.key === flight.resource)?.label ?? flight.resource}
                </span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
