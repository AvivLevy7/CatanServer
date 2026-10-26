import { useEffect, useState } from 'react';

const BANK_RATE = 4;

// Server ResourceType names -> display labels.
const RESOURCES = [
  { key: 'Lumber', label: 'Wood' },
  { key: 'Brick', label: 'Brick' },
  { key: 'Grain', label: 'Wheat' },
  { key: 'Wool', label: 'Sheep' },
  { key: 'Ore', label: 'Ore' },
];

const selectClass =
  'w-full rounded-md border border-sky-600 bg-sky-900 px-2 py-1.5 text-sm text-amber-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-200 disabled:cursor-not-allowed disabled:opacity-50';

/**
 * 4:1 bank trade. "Give" options the player cannot afford are disabled so only
 * valid trades can be submitted; the server still validates.
 */
export default function TradePanel({ player, onTrade, disabled }) {
  const resources = player?.resources ?? {};
  const affordable = RESOURCES.filter(({ key }) => (resources[key] ?? 0) >= BANK_RATE);

  const [give, setGive] = useState('');
  const [receive, setReceive] = useState(RESOURCES[0].key);

  // Keep "give" pointing at something the player can actually afford as the
  // inventory changes (e.g. after the trade goes through).
  useEffect(() => {
    if (!affordable.some(({ key }) => key === give)) {
      setGive(affordable[0]?.key ?? '');
    }
  }, [affordable, give]);

  // Never allow give === receive.
  useEffect(() => {
    if (give && give === receive) {
      setReceive(RESOURCES.find(({ key }) => key !== give).key);
    }
  }, [give, receive]);

  const canTrade = !disabled && give !== '' && receive !== '' && give !== receive;

  return (
    <section aria-label="Bank trade" className="rounded-xl bg-sky-800/70 p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-300">
        Bank Trade ({BANK_RATE}:1)
      </h2>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-sky-200">
          Give {BANK_RATE}
          <select
            value={give}
            onChange={(e) => setGive(e.target.value)}
            disabled={disabled || affordable.length === 0}
            className={selectClass}
          >
            {affordable.length === 0 && <option value="">Nothing to trade</option>}
            {RESOURCES.map(({ key, label }) => {
              const owned = resources[key] ?? 0;
              return (
                <option key={key} value={key} disabled={owned < BANK_RATE}>
                  {label} ({owned})
                </option>
              );
            })}
          </select>
        </label>

        <span aria-hidden="true" className="pb-2 text-lg font-bold text-amber-100">
          &rarr;
        </span>

        <label className="flex flex-col gap-1 text-xs text-sky-200">
          Receive 1
          <select
            value={receive}
            onChange={(e) => setReceive(e.target.value)}
            disabled={disabled}
            className={selectClass}
          >
            {RESOURCES.map(({ key, label }) => (
              <option key={key} value={key} disabled={key === give}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={() => onTrade(give, receive)}
        disabled={!canTrade}
        className="mt-3 w-full rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold text-stone-900 shadow transition hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Trade
      </button>
    </section>
  );
}
