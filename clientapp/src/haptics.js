/**
 * Mobile haptics. Every cue is a named pattern rather than a raw duration, so the
 * vocabulary stays consistent: a turn starting always feels the same wherever it is fired
 * from, and the whole set can be muted in one place.
 *
 * `navigator.vibrate` exists on Android browsers and is absent on iOS Safari and on
 * desktop; it also throws if called without a user gesture in some engines. Both are
 * handled by feature-detecting once and swallowing failures - a device that cannot buzz
 * simply does not, and nothing else in the game notices.
 */

const STORAGE_KEY = 'catan.haptics';

const PATTERNS = {
  // Your turn: two short taps, the "you're up" knock.
  turn: [18, 70, 18],
  // A 7: one longer, heavier pulse. Dread, not information.
  seven: [120],
  // A piece landing or a deal closing: one crisp click.
  click: [22],
  // Something was refused.
  reject: [10, 50, 10, 50, 10],
};

const supported = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

let enabled = localStorage.getItem(STORAGE_KEY) !== '0';
const listeners = new Set();

export const haptics = {
  /** False on iOS and desktop, where there is no vibration API to offer at all. */
  get available() {
    return supported();
  },

  get enabled() {
    return enabled;
  },

  /**
   * Fires one of the named patterns. Unknown names are ignored rather than guessed at,
   * so a typo cannot buzz the phone with something arbitrary.
   */
  play(name) {
    if (!enabled || !supported()) return;
    const pattern = PATTERNS[name];
    if (!pattern) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      /* some engines refuse outside a gesture; a missed buzz is not worth reporting */
    }
  },

  setEnabled(next) {
    enabled = !!next;
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    if (!enabled && supported()) {
      try {
        navigator.vibrate(0);
      } catch {
        /* nothing to cancel */
      }
    }
    for (const fn of listeners) fn(enabled);
    return enabled;
  },

  toggle() {
    return haptics.setEnabled(!enabled);
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
