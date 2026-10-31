import { useEffect, useRef, useState } from 'react';

// Long enough for the drop plus the dust to finish (see piece-drop / dust-puff).
const IMPACT_MS = 820;

const EMPTY = new Set();
const EMPTY_IMPACT = { nodes: EMPTY, edges: EMPTY };

/**
 * Spots pieces that have just appeared on the board and reports their ids for one beat,
 * so the markers can play their landing animation.
 *
 * It diffs consecutive server snapshots rather than listening to this tab's own clicks,
 * which means every seat at the table sees every placement land - including the bots'.
 * A settlement upgraded to a city counts as a new placement, because the piece standing
 * on the board really did change.
 *
 * The first snapshot after mounting (and the first after `resetKey` changes) is treated
 * as a baseline, so joining a game in progress does not set every existing piece off at
 * once.
 *
 * @param {Array} nodes intersections from the live board snapshot
 * @param {Array} edges paths from the live board snapshot
 * @param {*} resetKey changes to re-baseline, e.g. the restart counter
 * @returns {{nodes: Set<string>, edges: Set<string>}} ids placed within the last beat
 */
export function usePlacementImpact(nodes, edges, resetKey) {
  const prevNodes = useRef(null);
  const prevEdges = useRef(null);
  const baselineKey = useRef(resetKey);
  const timers = useRef(new Set());
  const [impact, setImpact] = useState(EMPTY_IMPACT);

  useEffect(() => {
    // A node's identity here is its owner plus whatever is standing on it.
    const nextNodes = new Map((nodes ?? []).map((n) => [n.id, `${n.ownerId ?? ''}:${n.building}`]));
    const nextEdges = new Map((edges ?? []).map((e) => [e.id, e.ownerId ?? '']));

    // New game: throw the old board away and take this snapshot as the baseline, rather
    // than reporting a fresh board's worth of placements.
    const rebaselining = baselineKey.current !== resetKey;
    baselineKey.current = resetKey;

    const before = rebaselining ? null : prevNodes.current;
    const beforeEdges = rebaselining ? null : prevEdges.current;
    prevNodes.current = nextNodes;
    prevEdges.current = nextEdges;

    if (before == null || beforeEdges == null) return undefined;

    const newNodes = [...nextNodes]
      .filter(([id, signature]) => signature !== ':None' && before.get(id) !== signature)
      .map(([id]) => id);
    const newEdges = [...nextEdges]
      .filter(([id, owner]) => owner !== '' && beforeEdges.get(id) !== owner)
      .map(([id]) => id);

    if (newNodes.length === 0 && newEdges.length === 0) return undefined;

    setImpact((current) => ({
      nodes: new Set([...current.nodes, ...newNodes]),
      edges: new Set([...current.edges, ...newEdges]),
    }));

    // Each batch clears only its own ids, so two placements landing a moment apart do not
    // cut each other's animation short.
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setImpact((current) => {
        const remainingNodes = new Set(current.nodes);
        const remainingEdges = new Set(current.edges);
        for (const id of newNodes) remainingNodes.delete(id);
        for (const id of newEdges) remainingEdges.delete(id);
        return remainingNodes.size === 0 && remainingEdges.size === 0
          ? EMPTY_IMPACT
          : { nodes: remainingNodes, edges: remainingEdges };
      });
    }, IMPACT_MS);

    timers.current.add(timer);
    return undefined;
  }, [nodes, edges, resetKey]);

  // Unmount: drop any clears still in flight.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  return impact;
}
