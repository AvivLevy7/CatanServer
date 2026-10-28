import { useEffect, useState } from 'react';
import PlayerTradePanel from './PlayerTradePanel';
import TradePanel from './TradePanel';
import { RESOURCES } from '../resources';

const TABS = [
  { id: 'players', label: 'Player Trade', glyph: '\u2696' },
  { id: 'bank', label: 'Bank / Port Trade', glyph: '\u2693' },
];

/**
 * One trade desk, two tabs. Player tab hosts the parchment decree builder; Bank tab the
 * maritime trade (rates come from the server's per-player bankRates: 4:1 default, 3:1 /
 * 2:1 once a matching harbour is settled). `onClose` dismisses; Escape works too.
 */
export default function TradeModal({
  onClose,
  player,
  opponents,
  activeOffer,
  lastResult,
  onPropose,
  onCancel,
  onBankTrade,
  disabled,
}) {
  const [tab, setTab] = useState('players');

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rates = player?.bankRates ?? {};
  const bestRate = Math.min(4, ...RESOURCES.map(({ key }) => rates[key] ?? 4));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Trade"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92svh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-amber-700/50 bg-gray-900/85 shadow-2xl shadow-black/70 backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header + tabs */}
        <div className="flex flex-none items-center justify-between gap-3 border-b border-amber-800/40 px-4 pt-3">
          <div role="tablist" aria-label="Trade type" className="flex gap-1">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.id)}
                  className={`relative -mb-px rounded-t-lg border border-b-0 px-4 py-2 font-display text-xs font-bold uppercase tracking-[0.2em] transition-all ${
                    active
                      ? 'border-amber-500/60 bg-gradient-to-b from-amber-300/20 to-transparent text-amber-200 shadow-[inset_0_2px_0_rgba(253,230,138,0.8)]'
                      : 'border-transparent text-parchment-300/70 hover:text-parchment-100'
                  }`}
                >
                  <span aria-hidden="true" className="mr-1.5">{t.glyph}</span>
                  {t.label}
                  {t.id === 'bank' && bestRate < 4 && (
                    <span className="ml-2 rounded-full bg-emerald-600/80 px-1.5 py-px text-[9px] text-emerald-50 ring-1 ring-emerald-300/60">
                      {bestRate}:1
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mb-1 rounded-lg border border-amber-100/30 px-3 py-1 font-display text-xs font-semibold uppercase tracking-wider text-parchment-100 transition-all hover:scale-105 hover:bg-gray-800"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5" role="tabpanel">
          {tab === 'players' ? (
            <PlayerTradePanel
              player={player}
              opponents={opponents}
              activeOffer={activeOffer}
              lastResult={lastResult}
              onPropose={onPropose}
              onCancel={onCancel}
              disabled={disabled}
            />
          ) : (
            <TradePanel player={player} onTrade={onBankTrade} disabled={disabled} />
          )}
        </div>
      </div>
    </div>
  );
}
