import { useEffect, useRef } from 'react';

// Must match TradeRules.OfferLifetime on the server.
export const OFFER_LIFETIME_MS = 15000;

// Below this the rim turns to warning colours.
const URGENT_MS = 5000;

/**
 * Wraps a trade widget in a rim that winds down as the offer's clock runs out.
 *
 * The countdown is driven entirely by the server's `expiresAt`, not a local timer, so every
 * player's rim empties at the moment the server actually withdraws the offer. The animation
 * is seeked with a negative delay rather than restarted, which means a panel that opens with
 * five seconds left picks the sweep up a third full instead of from the top.
 *
 * Both the seek and the colour change are written straight to the element in an effect. The
 * clock is outside React - reading it during render would make the render impure, and
 * holding it in state would re-render the whole panel for something only CSS needs.
 *
 * Children paint their own background over the middle, so only the 2px rim shows.
 */
export default function TradeTimerRing({ expiresAt, className = '', children }) {
  const ref = useRef(null);
  const expiry = expiresAt ? new Date(expiresAt).getTime() : null;

  useEffect(() => {
    const el = ref.current;
    if (!el || expiry == null) return undefined;

    const remaining = expiry - Date.now();
    const elapsed = Math.max(0, Math.min(OFFER_LIFETIME_MS, OFFER_LIFETIME_MS - remaining));
    el.style.animationDuration = `${OFFER_LIFETIME_MS}ms`;
    el.style.animationDelay = `-${elapsed}ms`;
    el.classList.toggle('trade-ring-urgent', remaining <= URGENT_MS);

    // One timer, for the single colour change; the sweep itself is pure CSS.
    const toUrgent = setTimeout(
      () => ref.current?.classList.add('trade-ring-urgent'),
      Math.max(0, remaining - URGENT_MS),
    );
    return () => clearTimeout(toUrgent);
  }, [expiry]);

  if (expiry == null) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div ref={ref} className={`trade-ring ${className}`}>
      {children}
    </div>
  );
}
