/**
 * The browser's claim on a seat: `{ roomId, playerId, token }`.
 *
 * The token is minted by the server when the player joins and is the only proof that this
 * browser owns that seat - the player id alone travels to the whole room in the lobby
 * state, so it cannot be trusted on its own.
 *
 * It is kept in **localStorage**, so closing the tab, reloading, losing the network or
 * putting the phone to sleep all leave the seat recoverable. A per-tab copy lives in
 * sessionStorage as well, and is preferred when present: that is what lets two tabs of the
 * same browser hold two different seats (handy for testing), because the second tab's own
 * copy wins over the shared one.
 *
 * Because localStorage is shared, a *fresh* tab would otherwise silently reclaim the seat
 * a tab already playing is sitting in - kicking it off its own socket. A heartbeat guards
 * against that: whichever tab is connected stamps `catan.session.live` every few seconds,
 * and a new tab that sees a fresh stamp from another tab does not take the seat. It offers
 * it instead, as a "rejoin" button on the landing page.
 */

const KEY = 'catan.session';
const LIVE_KEY = 'catan.session.live';

// A tab counts another tab's claim as live while its stamp is this recent.
const LIVE_TTL_MS = 12000;
export const HEARTBEAT_MS = 4000;

// Per page load, so a tab can tell its own heartbeat from another tab's.
const TAB_ID = Math.random().toString(36).slice(2);

function read(storage) {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.roomId && parsed?.playerId && parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

/** This tab's seat if it has one, else the browser's stored seat. Null if neither. */
export function readSession() {
  return read(sessionStorage) ?? read(localStorage);
}

/** True when the stored seat belongs to this tab specifically. */
export function isOwnTabSession() {
  return read(sessionStorage) !== null;
}

export function saveSession(session) {
  const raw = JSON.stringify(session);
  try {
    sessionStorage.setItem(KEY, raw);
    localStorage.setItem(KEY, raw);
  } catch {
    /* private mode with storage disabled: the seat just will not survive a reload */
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(KEY);
    if (readHeartbeat()?.tabId === TAB_ID) localStorage.removeItem(LIVE_KEY);
  } catch {
    /* nothing to clear */
  }
}

function readHeartbeat() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LIVE_KEY) ?? 'null');
    return parsed?.tabId && Date.now() - parsed.at < LIVE_TTL_MS ? parsed : null;
  } catch {
    return null;
  }
}

/** Says "this tab is holding the seat right now". Called on a timer while connected. */
export function beatHeartbeat() {
  try {
    localStorage.setItem(LIVE_KEY, JSON.stringify({ tabId: TAB_ID, at: Date.now() }));
  } catch {
    /* storage disabled; the worst case is a second tab taking the seat */
  }
}

/** True when some *other* tab of this browser is currently sitting in the stored seat. */
export function anotherTabHoldsSeat() {
  const beat = readHeartbeat();
  return beat !== null && beat.tabId !== TAB_ID;
}

/**
 * What to do with the stored seat on a fresh page load:
 *
 *  - `resume`: reclaim it now (a refresh, or a seat nobody is using).
 *  - `offer`:  another tab is playing it, so show it as a choice instead of taking it.
 *  - `none`:   nothing stored.
 */
export function restoreIntent() {
  const session = readSession();
  if (!session) return { kind: 'none', session: null };
  if (isOwnTabSession() || !anotherTabHoldsSeat()) return { kind: 'resume', session };
  return { kind: 'offer', session };
}
