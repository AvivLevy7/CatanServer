import { useEffect, useRef, useState } from 'react';

// Long enough for the last segment of a 10-road trail to finish its flare.
const CLAIM_MS = 2000;

const EMPTY = [];

/**
 * Watches the Longest Road title and, when it changes hands (or is claimed for the first
 * time), hands back the winning trail's edges for a couple of seconds so the board can run
 * a glow along them.
 *
 * It fires on a change of *holder*, not on every board update - a holder who extends their
 * own road has not claimed anything, so lighting it up again would be noise. The trail
 * itself comes from the server, which already computes it to award the title.
 *
 * @param {string|null} holderId current Longest Road holder
 * @param {Array<string>} path the holder's winning trail, as edge ids
 * @param {*} resetKey changes to re-baseline, e.g. the restart counter
 * @returns {Array<string>} edges to light up right now, empty when nothing is being claimed
 */
export function useRoadClaim(holderId, path, resetKey) {
  const previousHolder = useRef(undefined);
  const baselineKey = useRef(resetKey);
  const timer = useRef(null);
  const [claim, setClaim] = useState(EMPTY);

  useEffect(() => {
    const rebaselining = baselineKey.current !== resetKey;
    baselineKey.current = resetKey;

    // First sight of a game (or a brand new one) is a baseline, not a claim: joining a
    // game in progress should not replay someone else's moment.
    const first = previousHolder.current === undefined || rebaselining;
    const changed = previousHolder.current !== holderId;
    previousHolder.current = holderId;

    if (first || !changed || holderId == null || !path?.length) {
      if (first || changed) setClaim(EMPTY);
      return undefined;
    }

    setClaim(path);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setClaim(EMPTY), CLAIM_MS);
    return undefined;
  }, [holderId, path, resetKey]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return claim;
}
