import { useState } from 'react';

const RESOURCES = [
  { key: 'Lumber', label: 'Wood' },
  { key: 'Brick', label: 'Brick' },
  { key: 'Grain', label: 'Wheat' },
  { key: 'Wool', label: 'Sheep' },
  { key: 'Ore', label: 'Ore' },
];

const selectClass =
  'w-full rounded-md border border-sky-600 bg-sky-900 px-2 py-1.5 text-sm text-amber-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-200';

function Dialog({ title, children, onCancel }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-sm rounded-2xl bg-sky-900 p-5 shadow-2xl ring-1 ring-sky-700">
        <h2 className="text-base font-bold text-amber-50">{title}</h2>
        {children}
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 w-full rounded-lg border border-amber-100/40 px-3 py-1.5 text-sm text-amber-50 hover:bg-sky-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ResourceSelect({ label, value, onChange }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-sky-200">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        {RESOURCES.map(({ key, label: text }) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

const confirmClass =
  'mt-4 w-full rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold text-stone-900 shadow transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50';

/** Monopoly: pick one resource to take from every opponent. */
export function MonopolyModal({ onConfirm, onCancel, disabled }) {
  const [resource, setResource] = useState('Lumber');
  return (
    <Dialog title="Monopoly" onCancel={onCancel}>
      <p className="mt-1 text-sm text-sky-200">
        Every other player hands you all of the chosen resource.
      </p>
      <div className="mt-3">
        <ResourceSelect label="Resource" value={resource} onChange={setResource} />
      </div>
      <button type="button" onClick={() => onConfirm(resource)} disabled={disabled} className={confirmClass}>
        Take all {RESOURCES.find((r) => r.key === resource)?.label}
      </button>
    </Dialog>
  );
}

/** Year of Plenty: pick any two resources from the bank. */
export function YearOfPlentyModal({ onConfirm, onCancel, disabled }) {
  const [first, setFirst] = useState('Lumber');
  const [second, setSecond] = useState('Brick');
  return (
    <Dialog title="Year of Plenty" onCancel={onCancel}>
      <p className="mt-1 text-sm text-sky-200">Take any two resources from the bank.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <ResourceSelect label="First" value={first} onChange={setFirst} />
        <ResourceSelect label="Second" value={second} onChange={setSecond} />
      </div>
      <button type="button" onClick={() => onConfirm(first, second)} disabled={disabled} className={confirmClass}>
        Take cards
      </button>
    </Dialog>
  );
}
