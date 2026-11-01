import { useEffect, useState } from 'react';
import { RESOURCE_STYLE } from '../theme';
import { RESOURCES } from '../resources';

// One card's flight, the gap between cards leaving the same victim, and the cap on how
// many cards fly per victim (a seven-card haul would otherwise bury the screen).
const FLIGHT_MS = 820;
const STAGGER_MS = 90;
const MAX_CARDS_PER_VICTIM = 4;
const CARD_PX = 34;

/** Viewport centre of the first element matching `selector`, or null if it is not on screen. */
function centreOf(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  const box = el.getBoundingClientRect();
  if (box.width === 0 && box.height === 0) return null;
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/**
 * The Monopoly drain: every victim's cards of the declared resource visibly leave their
 * seat card and land in the caller's hand.
 *
 * Measured from the live DOM (seat chips publish `data-player-id`, the viewer's own hand
 * publishes `data-resource-hand`) so it lines up with wherever the HUD actually is, on a
 * phone or a desktop. Cards from one victim fan out in a small spread and cross the screen
 * on a curve, which reads as a handful being swept up rather than a tidy queue.
 *
 * @param {{id: number, playerId: string, playerName: string, resource: string,
 *          collected: number, takes: Array<{fromPlayerId: string, amount: number}>} | null} event
 * @param {Function} onDone called once the last card has landed
 */
export default function MonopolyDrain({ event, myPlayerId, onDone }) {
  const [run, setRun] = useState(null);

  useEffect(() => {
    if (!event?.id) return undefined;

    // Nothing was actually taken: no animation, just get out of the way.
    if (!event.takes?.length || !event.collected) {
      onDone?.();
      return undefined;
    }

    let launchFrame = 0;
    let paintFrame = 0;

    // Measured after the next paint: the seat chips may have only just re-rendered, and
    // reading layout inside the effect would also mean setting state synchronously in it.
    const measureFrame = requestAnimationFrame(() => {
      const thiefIsMe = event.playerId === myPlayerId;
      const to = thiefIsMe
        ? centreOf('[data-resource-hand]') ?? centreOf(`[data-player-id="${event.playerId}"]`)
        : centreOf(`[data-player-id="${event.playerId}"]`);

      const cards = [];
      if (to) {
        for (const take of event.takes) {
          const from = centreOf(`[data-player-id="${take.fromPlayerId}"]`);
          if (!from || !take.amount) continue;

          const copies = Math.min(take.amount, MAX_CARDS_PER_VICTIM);
          for (let i = 0; i < copies; i++) {
            cards.push({
              key: `${event.id}-${cards.length}`,
              // A small fan out of the victim's chip, so overlapping cards stay legible.
              from: { x: from.x + (i - (copies - 1) / 2) * 14, y: from.y + i * 4 },
              to,
              // The last card of a stack carries the count, if there was more than one.
              badge: i === copies - 1 && take.amount > 1 ? take.amount : null,
              delay: i * STAGGER_MS,
            });
          }
        }
      }

      if (cards.length === 0) {
        onDone?.();
        return;
      }

      setRun({ id: event.id, resource: event.resource, cards, launched: false });

      // Two more frames: the cards must be painted at their source before the transition
      // to the target will animate instead of jumping.
      launchFrame = requestAnimationFrame(() => {
        paintFrame = requestAnimationFrame(() =>
          setRun((current) => (current?.id === event.id ? { ...current, launched: true } : current)),
        );
      });
    });

    const finish = setTimeout(
      () => {
        setRun(null);
        onDone?.();
      },
      FLIGHT_MS + STAGGER_MS * MAX_CARDS_PER_VICTIM + 420,
    );

    return () => {
      cancelAnimationFrame(measureFrame);
      cancelAnimationFrame(launchFrame);
      cancelAnimationFrame(paintFrame);
      clearTimeout(finish);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

  if (!run) return null;

  const style = RESOURCE_STYLE[run.resource];
  if (!style) return null;
  const label = RESOURCES.find((r) => r.key === run.resource)?.label ?? run.resource;

  return (
    <div aria-hidden="true">
      {run.cards.map((card) => {
        const target = run.launched ? card.to : card.from;

        return (
          <div
            key={card.key}
            className="resource-flight"
            style={{
              // Horizontal leg. The vertical one rides on the inner element with a
              // different easing, which bends the path into an arc.
              transform: `translate3d(${(target.x - CARD_PX / 2).toFixed(1)}px, ${(
                card.from.y - CARD_PX / 2
              ).toFixed(1)}px, 0)`,
              transitionProperty: 'transform, opacity',
              transitionDuration: `${FLIGHT_MS}ms, 220ms`,
              transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.5, 1), ease-in',
              transitionDelay: `${card.delay}ms, ${FLIGHT_MS - 180 + card.delay}ms`,
              opacity: run.launched ? 0 : 1,
            }}
          >
            <div
              style={{
                transform: `translate3d(0, ${(target.y - card.from.y).toFixed(1)}px, 0) scale(${
                  run.launched ? 0.8 : 1
                }) rotate(${run.launched ? 14 : -8}deg)`,
                transition: `transform ${FLIGHT_MS}ms cubic-bezier(0.65, 0, 0.9, 0.55) ${card.delay}ms`,
              }}
            >
              <span
                className={`relative flex size-8 items-center justify-center rounded-md bg-gradient-to-b text-lg leading-none shadow-[0_3px_12px_rgba(0,0,0,0.7)] ring-1 ring-rose-200/70 ${style.card} ${style.ink}`}
              >
                <span>{style.glyph}</span>
                {card.badge && (
                  <span className="absolute -right-1.5 -top-1.5 rounded-full border border-rose-200 bg-rose-600 px-1 font-display text-[10px] font-black leading-tight text-rose-50">
                    {card.badge}
                  </span>
                )}
                <span className="sr-only">{label}</span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
