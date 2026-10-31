import { useState } from 'react';
import { RESOURCES } from '../resources';
import { H2, PANEL, RESOURCE_STYLE } from '../theme';
import { CheckIcon } from './icons';

const BANK_RATE = 4;

function PickCard({ resource, selected, disabled, onClick, badge, sub }) {
  const { label } = RESOURCES.find((r) => r.key === resource);
  const s = RESOURCE_STYLE[resource];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-pressed={selected}
      className={`relative flex h-16 w-12 flex-col items-center justify-between rounded-md bg-gradient-to-b p-1 shadow-lg ring-2 transition-all ${s.card} ${s.ink} ${
        selected ? 'scale-110 ring-amber-200 shadow-[0_0_18px_rgba(245,190,90,0.6)]' : 'ring-black/30'
      } ${disabled ? 'cursor-not-allowed opacity-35' : 'hover:-translate-y-0.5 hover:scale-110 hover:shadow-[0_0_16px_rgba(255,220,150,0.5)]'}`}
    >
      <span className="text-lg leading-none drop-shadow">{s.glyph}</span>
      <span className="font-display text-[8px] font-bold uppercase tracking-wider">{label}</span>
      {sub != null && <span className="text-[9px] font-semibold leading-none opacity-90">{sub}</span>}
      {badge != null && (
        <span className="absolute -right-1.5 -top-1.5 rounded-full bg-ink-900/90 px-1 font-display text-[9px] font-black text-amber-200 ring-1 ring-amber-700">
          {badge}
        </span>
      )}
    </button>
  );
}

/**
 * Bank trade at the player's best rate per resource (4:1, or 3:1 / 2:1 via ports).
 * Pick a card to give and a card to receive; the server still validates.
 */
export default function TradePanel({ player, onTrade, disabled }) {
  const resources = player?.resources ?? {};
  const rates = player?.bankRates ?? {};
  const rateFor = (key) => rates[key] ?? BANK_RATE;
  const affordable = RESOURCES.filter(({ key }) => (resources[key] ?? 0) >= rateFor(key));

  const [giveChoice, setGive] = useState('');
  const [receiveChoice, setReceive] = useState(RESOURCES[0].key);

  const give = affordable.some(({ key }) => key === giveChoice) ? giveChoice : affordable[0]?.key ?? '';
  const receive =
    give && give === receiveChoice ? RESOURCES.find(({ key }) => key !== give).key : receiveChoice;

  const canTrade = !disabled && give !== '' && receive !== '' && give !== receive;
  const currentRate = give ? rateFor(give) : BANK_RATE;
  const hasPort = RESOURCES.some(({ key }) => rateFor(key) < BANK_RATE);

  return (
    <section aria-label="Bank trade" className={PANEL}>
      <h2 className={`${H2} text-center`}>Maritime Trade</h2>
      <div className="rule-gold mb-3" aria-hidden="true" />

      <div className="flex flex-col gap-3">
        <div>
          <p className="mb-1.5 text-center font-display text-[10px] uppercase tracking-widest text-rose-300/80">
            Give {currentRate}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {RESOURCES.map(({ key }) => {
              const owned = resources[key] ?? 0;
              const rate = rateFor(key);
              return (
                <PickCard
                  key={key}
                  resource={key}
                  selected={give === key}
                  disabled={disabled || owned < rate}
                  onClick={() => setGive(key)}
                  badge={`${rate}:1`}
                  sub={`x${owned}`}
                />
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 text-parchment-500/70" aria-hidden="true">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-700/50 to-transparent" />
          <span className="font-display text-lg">&#8595;</span>
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-700/50 to-transparent" />
        </div>

        <div>
          <p className="mb-1.5 text-center font-display text-[10px] uppercase tracking-widest text-emerald-300/80">Receive 1</p>
          <div className="flex flex-wrap justify-center gap-2">
            {RESOURCES.map(({ key }) => (
              <PickCard
                key={key}
                resource={key}
                selected={receive === key}
                disabled={disabled || key === give}
                onClick={() => setReceive(key)}
              />
            ))}
          </div>
        </div>
      </div>

      {!hasPort && (
        <p className="mt-3 text-center text-[11px] italic text-parchment-300/70">Settle a harbour for 3:1 or 2:1 rates.</p>
      )}

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={() => onTrade(give, receive)}
          disabled={!canTrade}
          title="Trade with the bank"
          aria-label="Trade with the bank"
          className="flex size-14 items-center justify-center rounded-xl bg-gradient-to-b from-amber-200 to-amber-400 text-ink-900 shadow-lg shadow-amber-900/40 ring-1 ring-amber-100/70 transition-all hover:scale-110 hover:from-amber-100 hover:to-amber-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          <CheckIcon className="size-7" />
        </button>
      </div>
    </section>
  );
}
