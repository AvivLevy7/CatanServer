import { useCallback, useRef, useState } from 'react';

/**
 * Backing store for the floating icon feed.
 *
 * Entries drop themselves after `lifeMs`, which is the same span the CSS animation takes
 * to fade one out - so a line disappears from the DOM at the moment it finishes fading,
 * rather than lingering invisibly or vanishing mid-fade.
 *
 * Kept separate from the full game log on purpose: that one is a history to scroll back
 * through, this one is a glance.
 */
export function useMiniLog(lifeMs) {
  const [entries, setEntries] = useState([]);
  const seq = useRef(0);
  const timers = useRef(new Set());

  const push = useCallback(
    (entry) => {
      const id = ++seq.current;
      setEntries((current) => [...current.slice(-5), { ...entry, id }]);
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        setEntries((current) => current.filter((e) => e.id !== id));
      }, lifeMs);
      timers.current.add(timer);
    },
    [lifeMs],
  );

  const clear = useCallback(() => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current.clear();
    setEntries([]);
  }, []);

  return { entries, push, clear };
}
