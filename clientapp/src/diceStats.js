// Expected share of each total on two fair dice (out of 36).
export const EXPECTED_OUT_OF_36 = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

/** Every total two dice can make, in order. */
export const DICE_TOTALS = Object.keys(EXPECTED_OUT_OF_36).map(Number);

/**
 * The most-rolled total and how often it came up, or null before the first roll.
 * Ties go to the lower total, which keeps the answer stable as the game goes on.
 */
export function hottestTotal(frequencies) {
  let best = null;
  for (const total of DICE_TOTALS) {
    const count = frequencies?.[total] ?? 0;
    if (count > 0 && (best == null || count > best.count)) best = { total, count };
  }
  return best;
}

/** How many dice rolls a frequency map accounts for. */
export function totalRollCount(frequencies) {
  return DICE_TOTALS.reduce((sum, total) => sum + (frequencies?.[total] ?? 0), 0);
}
