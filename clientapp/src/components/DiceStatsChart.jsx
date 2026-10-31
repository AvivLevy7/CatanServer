import { DICE_TOTALS as TOTALS, EXPECTED_OUT_OF_36 as EXPECTED, hottestTotal } from '../diceStats';

/**
 * Flex-column bar chart of dice totals rolled so far, with a faint marker at the
 * statistically expected height so players can see hot and cold numbers.
 *
 * `animated` grows the bars out of the baseline left to right - worth it on the victory
 * screen, distracting in the live side drawer where it would replay on every roll.
 * `markHottest` crowns the most-rolled total.
 */
export default function DiceStatsChart({ frequencies, compact = false, animated = false, markHottest = false }) {
  const counts = TOTALS.map((t) => frequencies?.[t] ?? 0);
  const totalRolls = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...counts);
  const height = compact ? 'h-24' : 'h-48';
  const hottest = markHottest ? hottestTotal(frequencies) : null;

  return (
    <div>
      <div className={`flex ${height} items-end gap-1`} role="img" aria-label={`Dice distribution over ${totalRolls} rolls`}>
        {TOTALS.map((t, i) => {
          const count = counts[i];
          const expected = (EXPECTED[t] / 36) * totalRolls;
          const barPct = (count / max) * 100;
          const expectedPct = Math.min(100, (expected / max) * 100);
          const isSeven = t === 7;
          const isHottest = hottest?.total === t;
          return (
            <div key={t} className="relative h-full flex-1" title={`${t}: ${count} time${count === 1 ? '' : 's'}`}>
              {/* Track leaves headroom at the top for the count label. */}
              <div className="absolute inset-x-0 bottom-0 top-4 rounded-t bg-gray-900/40">
                <div
                  className={`absolute inset-x-0 bottom-0 rounded-t transition-[height] duration-300 ${
                    animated ? 'animate-bar-grow' : ''
                  } ${
                    isSeven
                      ? 'bg-gradient-to-t from-rose-700 to-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.5)]'
                      : isHottest
                        ? 'bg-gradient-to-t from-amber-500 to-amber-100 shadow-[0_0_14px_rgba(253,230,138,0.7)]'
                        : 'bg-gradient-to-t from-amber-600 to-amber-200 shadow-[0_0_10px_rgba(245,190,90,0.4)]'
                  }`}
                  style={{ height: `${barPct}%`, '--bar-delay': animated ? `${i * 55}ms` : undefined }}
                >
                  {count > 0 && (
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-semibold tabular-nums text-parchment-50">
                      {count}
                    </span>
                  )}
                </div>
                {totalRolls > 0 && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-sky-200/60"
                    style={{ bottom: `${expectedPct}%` }}
                    aria-hidden="true"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1">
        {TOTALS.map((t) => (
          <span
            key={t}
            className={`flex-1 text-center text-[11px] font-semibold ${
              t === 7 ? 'text-rose-300' : hottest?.total === t ? 'font-black text-amber-100' : 'text-parchment-200'
            }`}
          >
            {t}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-parchment-300/80">
        {totalRolls} roll{totalRolls === 1 ? '' : 's'} &middot; dashed line = expected frequency
      </p>
    </div>
  );
}
