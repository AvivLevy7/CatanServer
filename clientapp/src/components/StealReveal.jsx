import { useEffect, useState } from 'react';
import { RESOURCES } from '../resources';
import { RESOURCE_STYLE, seat } from '../theme';
import { sound } from '../audio';
import { haptics } from '../haptics';

/** The robbery stamp - a pirate flag - shared by the callout and the mini event feed. */
export const PIRATE_GLYPH = '\u{1F3F4}\u{200D}\u{2620}\u{FE0F}';

// The card's flight, and how long the callout holds once it has landed.
const FLIGHT_MS = 900;
const HOLD_MS = 1400;
const CARD_PX = 40;

/** Viewport centre of the first element matching `selector`, or null if it is not on screen. */
function centreOf(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  const box = el.getBoundingClientRect();
  if (box.width === 0 && box.height === 0) return null;
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/**
 * A robbery, shown to everyone who is not the thief.
 *
 * The thief has their own theatre (see BlindStealOverlay) and everybody else used to learn
 * about a steal only from a line in the log - so a robbery between two opponents went by
 * unseen and the card counts on the seat chips quietly disagreed with what you thought you
 * had watched happen. Every other seat now gets the same beat: a callout naming both sides
 * and the card itself visibly leaving the victim's seat chip and landing on the thief's.
 *
 * Measured from the live DOM, like the other flights, because the seat chips move with the
 * layout (`data-player-id`) and the viewer's own hand sits somewhere else entirely
 * (`data-resource-hand`).
 *
 * @param {{id: number, movedBy: string, hexId: string, victimId: string|null,
 *          stolenResource: string|null} | null} event a new `id` plays a new robbery
 * @param {Array} players public player views, for names and seat colours
 * @param {string} myPlayerId this seat, so the thief is skipped and the victim addressed
 */
export default function StealReveal({ event, players, myPlayerId }) {
  const [run, setRun] = useState(null);

  useEffect(() => {
    // No victim means the robber merely moved: nothing was taken, nothing to show. The
    // thief, meanwhile, is watching their own hand of face-down cards instead. Either way
    // any robbery still on screen is dropped, rather than left standing with a stale card.
    if (!event?.id || !event.victimId || event.movedBy === myPlayerId) {
      const clear = requestAnimationFrame(() => setRun(null));
      return () => cancelAnimationFrame(clear);
    }

    let launchFrame = 0;
    let paintFrame = 0;

    // Measured after the next paint: the seat chips may have only just re-rendered with
    // the new card counts, and reading layout inside the effect would also mean setting
    // state synchronously in it.
    const measureFrame = requestAnimationFrame(() => {
      const iAmVictim = event.victimId === myPlayerId;
      const from = iAmVictim
        ? centreOf('[data-resource-hand]') ?? centreOf(`[data-player-id="${event.victimId}"]`)
        : centreOf(`[data-player-id="${event.victimId}"]`);
      const to = centreOf(`[data-player-id="${event.movedBy}"]`);

      // The robbery is snapshotted into the run, not read from the prop at render time: a
      // second steal lands a frame before this effect gets to measure it, and reading the
      // prop would caption the flight already on screen with the new theft's details.
      // The callout stands on its own if either seat is off screen; only the flight needs
      // both endpoints.
      setRun({
        id: event.id,
        thiefId: event.movedBy,
        victimId: event.victimId,
        resource: event.stolenResource ?? null,
        iAmVictim,
        flight: from && to ? { from, to } : null,
        launched: false,
      });

      sound.play('steal');
      if (iAmVictim) haptics.play('seven');

      if (!from || !to) return;

      // Two more frames: the card has to be painted at the victim's seat before the
      // transition to the thief's will animate instead of jumping.
      launchFrame = requestAnimationFrame(() => {
        paintFrame = requestAnimationFrame(() =>
          setRun((current) => (current?.id === event.id ? { ...current, launched: true } : current)),
        );
      });
    });

    const finish = setTimeout(
      () => setRun((current) => (current?.id === event.id ? null : current)),
      FLIGHT_MS + HOLD_MS,
    );

    return () => {
      cancelAnimationFrame(measureFrame);
      cancelAnimationFrame(launchFrame);
      cancelAnimationFrame(paintFrame);
      clearTimeout(finish);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, myPlayerId]);

  if (!run) return null;

  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? 'Someone';
  const colorOf = (id) => seat(players.find((p) => p.id === id)?.color);

  const thief = nameOf(run.thiefId);
  const victim = nameOf(run.victimId);
  const thiefSeat = colorOf(run.thiefId);
  const victimSeat = colorOf(run.victimId);
  const iAmVictim = run.iAmVictim;

  const style = run.resource ? RESOURCE_STYLE[run.resource] : null;
  const label = RESOURCES.find((r) => r.key === run.resource)?.label ?? run.resource;

  const target = run.launched ? run.flight?.to : run.flight?.from;

  return (
    <>
      {/* The callout. Centred and clear of the HUD rows, because this is the one moment
          where cards change hands without anybody at this screen having tapped anything. */}
      <div
        aria-live="polite"
        className="animate-steal-callout pointer-events-none fixed left-1/2 top-[38%] z-[46] flex -translate-x-1/2 flex-col items-center gap-2 max-md:top-[34%]"
      >
        <div className="flex items-center gap-2.5 rounded-2xl border border-rose-400/50 bg-gray-950/85 px-4 py-2.5 shadow-[0_10px_40px_rgba(0,0,0,0.75)] ring-1 ring-rose-500/30 backdrop-blur-sm max-md:gap-2 max-md:px-3 max-md:py-2">
          <span aria-hidden="true" className="text-2xl leading-none max-md:text-xl">
            {PIRATE_GLYPH}
          </span>
          <div className="text-left">
            <p className="font-display text-[9px] font-black uppercase tracking-[0.3em] text-rose-300/90">
              {iAmVictim ? 'You were robbed' : 'Robbery'}
            </p>
            <p className="font-display text-sm font-black tracking-wide text-parchment-50 max-md:text-xs">
              <span className={thiefSeat.text}>{thief}</span>
              <span className="text-parchment-300/80"> took a card from </span>
              <span className={victimSeat.text}>{iAmVictim ? 'you' : victim}</span>
            </p>
          </div>
          {style ? (
            <span
              className={`flex size-9 items-center justify-center rounded-lg bg-gradient-to-b text-xl leading-none ring-1 ${style.card} ${style.ink} max-md:size-8 max-md:text-lg`}
            >
              <span aria-hidden="true">{style.glyph}</span>
              <span className="sr-only">{label}</span>
            </span>
          ) : (
            <span className="rounded-lg border border-amber-700/50 px-2 py-1 font-display text-[10px] font-bold uppercase tracking-wider text-parchment-300/80">
              Empty hand
            </span>
          )}
        </div>
      </div>

      {/* The card itself, crossing from the victim's seat to the thief's. */}
      {run.flight && (
        <div aria-hidden="true">
          <div
            className="resource-flight"
            style={{
              // Horizontal leg; the vertical one rides on the inner element with a
              // different easing, which bends the path into an arc.
              transform: `translate3d(${(target.x - CARD_PX / 2).toFixed(1)}px, ${(
                run.flight.from.y - CARD_PX / 2
              ).toFixed(1)}px, 0)`,
              transitionProperty: 'transform, opacity',
              transitionDuration: `${FLIGHT_MS}ms, 240ms`,
              transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.5, 1), ease-in',
              transitionDelay: `0ms, ${FLIGHT_MS - 200}ms`,
              opacity: run.launched ? 0 : 1,
            }}
          >
            <div
              style={{
                transform: `translate3d(0, ${(target.y - run.flight.from.y).toFixed(1)}px, 0) scale(${
                  run.launched ? 0.78 : 1
                }) rotate(${run.launched ? 18 : -10}deg)`,
                transition: `transform ${FLIGHT_MS}ms cubic-bezier(0.65, 0, 0.9, 0.55)`,
              }}
            >
              {style ? (
                <span
                  className={`flex size-10 items-center justify-center rounded-lg bg-gradient-to-b text-xl leading-none shadow-[0_4px_16px_rgba(0,0,0,0.75)] ring-2 ring-rose-300/70 ${style.card} ${style.ink}`}
                >
                  {style.glyph}
                </span>
              ) : (
                <span className="relative flex size-10 items-center justify-center rounded-lg border border-amber-700/60 bg-gradient-to-b from-ink-800 to-ink-900 shadow-[0_4px_16px_rgba(0,0,0,0.75)] ring-2 ring-rose-300/70">
                  <span className="font-display text-lg font-black text-amber-400/70">C</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
