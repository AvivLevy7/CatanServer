// Server ResourceType names -> display labels. Shared by trade UIs.
export const RESOURCES = [
  { key: 'Lumber', label: 'Wood', abbr: 'WD', chip: 'bg-green-700 text-green-50' },
  { key: 'Brick', label: 'Brick', abbr: 'BR', chip: 'bg-red-700 text-red-50' },
  { key: 'Grain', label: 'Wheat', abbr: 'WH', chip: 'bg-yellow-500 text-yellow-950' },
  { key: 'Wool', label: 'Sheep', abbr: 'SH', chip: 'bg-lime-300 text-lime-950' },
  { key: 'Ore', label: 'Ore', abbr: 'OR', chip: 'bg-slate-500 text-slate-50' },
];

export const EMPTY_BUNDLE = Object.freeze(Object.fromEntries(RESOURCES.map(({ key }) => [key, 0])));

/** Summarises a bundle as "2 Wood, 1 Ore"; "nothing" when empty. */
export function describeBundle(bundle) {
  const parts = RESOURCES
    .filter(({ key }) => (bundle?.[key] ?? 0) > 0)
    .map(({ key, label }) => `${bundle[key]} ${label}`);
  return parts.length ? parts.join(', ') : 'nothing';
}
