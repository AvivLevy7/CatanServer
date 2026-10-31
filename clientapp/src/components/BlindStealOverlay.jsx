import { useEffect, useState } from 'react';
import { RESOURCES } from '../resources';
import { RESOURCE_STYLE, seat } from '../theme';
import { sound } from '../audio';

// Half the flip's duration: the point where the card is edge-on and its face can be
// swapped without the swap being visible. Must track `steal-flip` in index.css.
const FLIP_HALFWAY_MS = 360;
// How long the stolen card is held up before the overlay bows out.
const REVEAL_HOLD_MS = 1500;

const MAX_FAN_DEGREES = 52;

/**
 * The blind steal, played out as a hand of face-down cards.
 *
 * The thief sees the victim's hand fanned out, backs towards them, and physically picks
 * one. Which card they pick cannot change the outcome - the server picks the stolen
 * resource at random, exactly as the rules require - so this is theatre, but it is the
 * theatre the moment deserves. The pick is what sends `MoveRobber`; the chosen card then
 * turns over to show whatever the server actually handed out.
 *
 * @param {object} victim the chosen victim, public view (hand is a count, not a list)
 * @param {Function} onPick sends the steal; receives nothing, the server rolls the card
 * @param {Function} onCancel backs out to pick a different victim or tile
 * @param {string|null} stolenResource what the server says was taken, once it answers
 * @param {Function} onDone close once the reveal has been held
 */
export default function BlindStealOverlay({
  victim,
  onPick,
  onCancel,
  stolenResource,
  onDone,
  disabled,
}) {
  const [picked, setPicked] = useState(null);
  const [flipped, setFlipped] = useState(false);

  const handSize =
    victim?.resourceCardCount ??
    Object.values(victim?.resources ?? {}).reduce((sum, n) => sum + n, 0);
  // An opponent with an empty hand is still a legal robber target; they just lose nothing.
  const cards = Math.max(1, Math.min(handSize, 12));
  const emptyHanded = handSize === 0;
  const s = seat(victim?.color);

  // Turn the card over only once the server has said what was on it.
  useEffect(() => {
    if (picked == null || !stolenResource) return undefined;
    const flip = setTimeout(() => setFlipped(true), FLIP_HALFWAY_MS);
    const close = setTimeout(() => onDone?.(), FLIP_HALFWAY_MS + REVEAL_HOLD_MS);
    return () => {
      clearTimeout(flip);
      clearTimeout(close);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, stolenResource]);

  // Nothing to reveal (the victim held no cards): let the beat land, then move on.
  useEffect(() => {
    if (picked == null || stolenResource || !emptyHanded) return undefined;
    const close = setTimeout(() => onDone?.(), 900);
    return () => clearTimeout(close);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, stolenResource, emptyHanded]);

  const take = (index) => {
    if (picked != null || disabled) return;
    setPicked(index);
    sound.play('steal');
    onPick();
  };

  const style = stolenResource ? RESOURCE_STYLE[stolenResource] : null;
  const stolenLabel = RESOURCES.find((r) => r.key === stolenResource)?.label ?? stolenResource;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="steal-hand-title"
      className="fixed inset-0 z-[50] flex animate-fade-in flex-col items-center justify-center gap-5 bg-black/70 p-4 backdrop-blur-sm max-md:gap-4"
    >
      <header className="text-center">
        <p className="font-display text-[10px] font-black uppercase tracking-[0.35em] text-rose-300/90">
          The robber strikes
        </p>
        <h2
          id="steal-hand-title"
          className="mt-1 flex items-center justify-center gap-2 font-display text-2xl font-black tracking-wide text-parchment-50 max-md:text-xl"
        >
          <span aria-hidden="true" className={`inline-block size-3 rounded-full ${s.dot}`} />
          {victim?.name ?? 'Your victim'}
        </h2>
        <p className="mt-1 text-xs text-parchment-300/90" aria-live="polite">
          {picked == null
            ? emptyHanded
              ? 'Their hand is empty - take it anyway.'
              : `Take one of their ${handSize} cards. You cannot see which is which.`
            : stolenResource
              ? `You took 1 ${stolenLabel}!`
              : emptyHanded
                ? 'Nothing to take.'
                : 'Pulling a card...'}
        </p>
      </header>

      {/* The fan. Each card is an offset wrapper plus a rotating face, so the keyframes
          can own the rotation without losing the horizontal spread. */}
      <div
        className="relative h-44 w-full max-w-[min(92vw,30rem)] max-md:h-36"
        role="group"
        aria-label={`${victim?.name ?? 'Opponent'}'s hand, face down`}
      >
        {Array.from({ length: cards }, (_, i) => {
          const spread = cards === 1 ? 0 : (i / (cards - 1) - 0.5) * 2;
          const rotation = spread * (MAX_FAN_DEGREES / 2);
          const offsetX = spread * Math.min(150, cards * 17);
          const isPicked = picked === i;
          const faded = picked != null && !isPicked;

          return (
            <div
              key={i}
              className="absolute bottom-0 left-1/2 transition-opacity duration-300"
              style={{
                transform: `translateX(calc(-50% + ${offsetX.toFixed(1)}px))`,
                opacity: faded ? 0.25 : 1,
                zIndex: isPicked ? 20 : i,
              }}
            >
              <button
                type="button"
                onClick={() => take(i)}
                disabled={disabled || picked != null}
                aria-label={isPicked ? 'The card you took' : `Take face-down card ${i + 1}`}
                className={`${isPicked ? 'animate-steal-flip' : 'animate-steal-fan'} block origin-bottom rounded-xl outline-none ring-offset-0 transition-transform ${
                  picked == null
                    ? 'cursor-pointer [@media(hover:hover)]:hover:-translate-y-3 [@media(hover:hover)]:hover:scale-105 focus-visible:-translate-y-3'
                    : 'cursor-default'
                }`}
                style={{
                  '--fan-rot': `${rotation.toFixed(2)}deg`,
                  animationDelay: isPicked ? '0ms' : `${i * 38}ms`,
                }}
              >
                {/* rotateY(180deg) on the flip mirrors the content, so the revealed face
                    is flipped back with scaleX(-1). */}
                <span
                  className="block"
                  style={flipped ? { transform: 'scaleX(-1)' } : undefined}
                >
                  {flipped && isPicked && style ? (
                    <span
                      className={`flex h-28 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-amber-100/70 bg-gradient-to-b p-2 shadow-[0_8px_24px_rgba(0,0,0,0.7)] ring-2 ${style.card} ${style.ink} max-md:h-24 max-md:w-16`}
                    >
                      <span className="text-3xl leading-none max-md:text-2xl" aria-hidden="true">
                        {style.glyph}
                      </span>
                      <span className="font-display text-[9px] font-black uppercase tracking-widest">
                        {stolenLabel}
                      </span>
                    </span>
                  ) : (
                    <span className="relative flex h-28 w-20 items-center justify-center rounded-xl border border-amber-700/60 bg-gradient-to-b from-ink-800 to-ink-900 shadow-[0_8px_24px_rgba(0,0,0,0.7)] max-md:h-24 max-md:w-16">
                      <span
                        aria-hidden="true"
                        className="absolute inset-2 rounded-lg border border-amber-600/30 bg-[repeating-linear-gradient(45deg,rgba(245,190,90,0.1)_0_6px,transparent_6px_12px)]"
                      />
                      <span className="relative font-display text-2xl font-black text-amber-400/70">C</span>
                    </span>
                  )}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {picked == null && (
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="rounded-lg border border-amber-100/40 px-4 py-1.5 text-sm text-parchment-50 transition hover:bg-gray-800 disabled:opacity-50"
        >
          Pick a different target
        </button>
      )}
    </div>
  );
}
