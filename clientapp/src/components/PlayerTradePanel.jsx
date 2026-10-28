import { useEffect, useState } from 'react';

// Server ResourceType names -> display labels.
const RESOURCES = [
  { key: 'Lumber', label: 'Wood', abbr: 'WD', chip: 'bg-green-700 text-green-50' },
  { key: 'Brick', label: 'Brick', abbr: 'BR', chip: 'bg-red-700 text-red-50' },
  { key: 'Grain', label: 'Wheat', abbr: 'WH', chip: 'bg-yellow-500 text-yellow-950' },
  { key: 'Wool', label: 'Sheep', abbr: 'SH', chip: 'bg-lime-300 text-lime-950' },
  { key: 'Ore', label: 'Ore', abbr: 'OR', chip: 'bg-slate-500 text-slate-50' },
];

const EMPTY = Object.fromEntries(RESOURCES.map(({ key }) => [key, 0]));

const stepButton =
  'size-6 rounded bg-sky-700 text-sm font-bold leading-none text-amber-50 hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40';

function Counter({ value, max, onChange, disabled }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= 0}
        className={stepButton}
        aria-label="Decrease"
      >
        -
      </button>
      <span className="w-4 text-center text-sm font-semibold text-amber-50">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={disabled || (max != null && value >= max)}
        className={stepButton}
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}

function BundleEditor({ title, bundle, setBundle, limits, lockedKeys, disabled }) {
  return (
    <div>
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-sky-300">{title}</h3>
      <ul className="flex flex-col gap-1">
        {RESOURCES.map(({ key, label, abbr, chip }) => {
          const max = limits?.[key];
          const locked = lockedKeys.has(key);
          return (
            <li key={key} className="flex items-center justify-between rounded bg-sky-900/60 px-2 py-1">
              <span className="flex items-center gap-2 text-xs text-amber-50" title={label}>
                <span className={`rounded px-1 text-[10px] font-bold leading-4 ${chip}`}>{abbr}</span>
                {label}
                {max != null && <span className="text-sky-400">({max})</span>}
              </span>
              <Counter
                value={bundle[key]}
                max={max}
                disabled={disabled || (locked && bundle[key] === 0)}
                onChange={(next) => setBundle({ ...bundle, [key]: Math.max(0, next) })}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Summarises a bundle as "2 Wood, 1 Ore"; "nothing" when empty. */
export function describeBundle(bundle) {
  const parts = RESOURCES
    .filter(({ key }) => (bundle?.[key] ?? 0) > 0)
    .map(({ key, label }) => `${bundle[key]} ${label}`);
  return parts.length ? parts.join(', ') : 'nothing';
}

/**
 * Lets the current player assemble a player-to-player offer: what to give, what
 * to get, and who to ask. While an offer is outstanding it shows its status and
 * a withdraw button instead.
 */
export default function PlayerTradePanel({
  player,
  opponents,
  activeOffer,
  lastResult,
  onPropose,
  onCancel,
  disabled,
}) {
  const [give, setGive] = useState(EMPTY);
  const [get, setGet] = useState(EMPTY);
  const [target, setTarget] = useState('');

  const resources = player?.resources ?? {};

  // Clamp "give" to what the player actually holds as the hand changes.
  useEffect(() => {
    setGive((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const { key } of RESOURCES) {
        const owned = resources[key] ?? 0;
        if (next[key] > owned) {
          next[key] = owned;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [resources]);

  // Reset the builder when the turn passes to someone else.
  useEffect(() => {
    setGive(EMPTY);
    setGet(EMPTY);
    setTarget('');
  }, [player?.id]);

  const giveKeys = new Set(RESOURCES.filter(({ key }) => give[key] > 0).map(({ key }) => key));
  const getKeys = new Set(RESOURCES.filter(({ key }) => get[key] > 0).map(({ key }) => key));
  const hasContent = giveKeys.size > 0 || getKeys.size > 0;
  const canSend = !disabled && hasContent && !activeOffer;

  const mine = activeOffer && activeOffer.senderPlayerId === player?.id;
  const targetName = (id) => opponents.find((o) => o.id === id)?.name ?? 'Anyone';

  return (
    <section aria-label="Player trade" className="rounded-xl bg-sky-800/70 p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-300">Trade with players</h2>

      {mine ? (
        <div className="rounded-lg bg-sky-900/60 p-3 text-sm text-amber-50">
          <p className="font-semibold">Offer to {targetName(activeOffer.targetPlayerId)}</p>
          <p className="mt-1 text-xs text-sky-200">
            Give {describeBundle(activeOffer.resourcesOffered)} &rarr; Get {describeBundle(activeOffer.resourcesRequested)}
          </p>
          {activeOffer.declinedBy?.length > 0 && (
            <p className="mt-1 text-xs text-rose-300">
              Declined by {activeOffer.declinedBy.map(targetName).join(', ')}
            </p>
          )}
          <p className="mt-2 text-xs text-sky-300">Waiting for a response...</p>
          <button
            type="button"
            onClick={() => onCancel(activeOffer.offerId)}
            disabled={disabled}
            className="mt-3 w-full rounded-lg border border-amber-100/40 px-3 py-1.5 text-sm text-amber-50 hover:bg-sky-800 disabled:opacity-50"
          >
            Withdraw offer
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <BundleEditor
              title="You give"
              bundle={give}
              setBundle={setGive}
              limits={resources}
              lockedKeys={getKeys}
              disabled={disabled}
            />
            <BundleEditor
              title="You get"
              bundle={get}
              setBundle={setGet}
              lockedKeys={giveKeys}
              disabled={disabled}
            />
          </div>

          <label className="mt-3 flex flex-col gap-1 text-xs text-sky-200">
            Offer to
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={disabled}
              className="w-full rounded-md border border-sky-600 bg-sky-900 px-2 py-1.5 text-sm text-amber-50 disabled:opacity-50"
            >
              <option value="">Anyone</option>
              {opponents.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>

          {lastResult && (
            <p
              className={`mt-2 text-xs ${
                lastResult.outcome === 'Accepted' ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {lastResult.outcome === 'Accepted' && `Trade accepted by ${targetName(lastResult.byPlayerId)}.`}
              {lastResult.outcome === 'Rejected' && 'Your offer was declined.'}
              {lastResult.outcome === 'Cancelled' && 'Offer withdrawn.'}
            </p>
          )}

          <button
            type="button"
            onClick={() => onPropose(target || null, give, get)}
            disabled={!canSend}
            className="mt-3 w-full rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold text-stone-900 shadow transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send offer
          </button>
        </>
      )}
    </section>
  );
}
