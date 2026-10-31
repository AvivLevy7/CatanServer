/**
 * Building costs, mirrored from Domain/GameRules.cs.
 *
 * These drive what the UI *offers* - which cards to light up, when to show a build as
 * unaffordable, what to pre-fill a trade with. The server remains the only authority on
 * whether a build is legal; everything here is presentation.
 */
export const BUILDS = [
  { id: 'road', label: 'Road', cost: { Lumber: 1, Brick: 1 }, hint: 'Click a path on the board' },
  {
    id: 'settlement',
    label: 'Settlement',
    cost: { Lumber: 1, Brick: 1, Grain: 1, Wool: 1 },
    hint: 'Click an empty intersection',
  },
  { id: 'city', label: 'City', cost: { Grain: 2, Ore: 3 }, hint: 'Click one of your settlements' },
  {
    id: 'developmentCard',
    label: 'Dev Card',
    cost: { Ore: 1, Grain: 1, Wool: 1 },
    hint: 'Draw from the development deck',
  },
];

export const BUILD_BY_ID = Object.fromEntries(BUILDS.map((b) => [b.id, b]));

/** True when `resources` covers every line of `cost`. */
export const canAfford = (resources, cost) =>
  Object.entries(cost ?? {}).every(([key, amount]) => (resources?.[key] ?? 0) >= amount);

/**
 * What is still needed to pay `cost` out of `resources`, as a bundle of positive amounts.
 * Empty when the cost is already covered - which is exactly the bundle to drop into the
 * "requesting" side of a trade.
 */
export function missingFor(resources, cost) {
  const missing = {};
  for (const [key, amount] of Object.entries(cost ?? {})) {
    const short = amount - (resources?.[key] ?? 0);
    if (short > 0) missing[key] = short;
  }
  return missing;
}

/** Total number of cards in a bundle. */
export const bundleSize = (bundle) =>
  Object.values(bundle ?? {}).reduce((sum, n) => sum + (n ?? 0), 0);
