/**
 * Jewel-tone seat palette. Keys are the server's PlayerColor names; the values map
 * onto the --color-seat-* tokens declared in index.css.
 */
export const SEAT = {
  Red: {
    label: 'Crimson',
    dot: 'bg-seat-red shadow-[0_0_10px_var(--color-seat-red-glow)]',
    ring: 'ring-seat-red-glow',
    text: 'text-seat-red-glow',
    fill: 'fill-seat-red',
    stroke: 'stroke-seat-red',
    gradient: 'from-seat-red to-rose-950',
  },
  Blue: {
    label: 'Sapphire',
    dot: 'bg-seat-blue shadow-[0_0_10px_var(--color-seat-blue-glow)]',
    ring: 'ring-seat-blue-glow',
    text: 'text-seat-blue-glow',
    fill: 'fill-seat-blue',
    stroke: 'stroke-seat-blue',
    gradient: 'from-seat-blue to-indigo-950',
  },
  Orange: {
    label: 'Amber',
    dot: 'bg-seat-orange shadow-[0_0_10px_var(--color-seat-orange-glow)]',
    ring: 'ring-seat-orange-glow',
    text: 'text-seat-orange-glow',
    fill: 'fill-seat-orange',
    stroke: 'stroke-seat-orange',
    gradient: 'from-seat-orange to-amber-950',
  },
  White: {
    label: 'Ivory',
    dot: 'bg-seat-white shadow-[0_0_10px_var(--color-seat-white-glow)]',
    ring: 'ring-seat-white-glow',
    text: 'text-parchment-50',
    fill: 'fill-seat-white',
    stroke: 'stroke-seat-white',
    gradient: 'from-stone-300 to-stone-600',
  },
  Green: {
    label: 'Emerald',
    dot: 'bg-seat-green shadow-[0_0_10px_var(--color-seat-green-glow)]',
    ring: 'ring-seat-green-glow',
    text: 'text-seat-green-glow',
    fill: 'fill-seat-green',
    stroke: 'stroke-seat-green',
    gradient: 'from-seat-green to-emerald-950',
  },
};

export const seat = (color) => SEAT[color] ?? SEAT.White;

/** Resource card look: rich gradients + emoji glyph for quick recognition. */
export const RESOURCE_STYLE = {
  Lumber: { glyph: '\u{1F332}', card: 'from-emerald-700 to-emerald-950 ring-emerald-400/50', ink: 'text-emerald-100' },
  Brick: { glyph: '\u{1F9F1}', card: 'from-red-700 to-red-950 ring-red-400/50', ink: 'text-red-100' },
  Grain: { glyph: '\u{1F33E}', card: 'from-yellow-500 to-yellow-800 ring-yellow-200/60', ink: 'text-yellow-50' },
  Wool: { glyph: '\u{1F411}', card: 'from-lime-400 to-lime-700 ring-lime-100/60', ink: 'text-lime-950' },
  Ore: { glyph: '\u26F0', card: 'from-slate-500 to-slate-800 ring-slate-300/50', ink: 'text-slate-50' },
};

/* Shared class fragments */
export const BTN_GOLD =
  'rounded-lg bg-gradient-to-b from-amber-200 to-amber-400 px-4 py-2 font-display text-sm font-bold tracking-wide text-ink-900 shadow-lg shadow-amber-900/40 ring-1 ring-amber-100/70 transition-all hover:scale-[1.03] hover:from-amber-100 hover:to-amber-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100';

export const BTN_GHOST =
  'rounded-lg border border-amber-600/50 bg-gray-900/40 px-4 py-2 font-display text-sm font-semibold tracking-wide text-parchment-100 transition-all hover:scale-[1.02] hover:border-amber-400 hover:bg-gray-900/70 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100';

export const PANEL = 'panel-glass p-4';

export const H2 =
  'mb-2 font-display text-[11px] font-bold uppercase tracking-[0.25em] text-amber-300/90';
