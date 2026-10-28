import { useEffect, useRef } from 'react';

/**
 * Scrolling game log. Entries: { id, text, tone?: 'info' | 'good' | 'bad' }.
 */
export default function GameLog({ entries, className = '' }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [entries.length]);

  const toneClass = {
    good: 'text-emerald-300',
    bad: 'text-rose-300',
    info: 'text-parchment-100',
  };

  return (
    <section aria-label="Game log" className={`panel-glass flex min-h-0 flex-col p-4 ${className}`}>
      <h2 className="mb-2 font-display text-[11px] font-bold uppercase tracking-[0.25em] text-amber-300/90">Chronicle</h2>
      <div className="rule-gold mb-3" aria-hidden="true" />
      <ol className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1 text-sm leading-snug">
        {entries.length === 0 && <li className="text-xs italic text-parchment-300/70">Nothing has happened yet.</li>}
        {entries.map((entry) => (
          <li key={entry.id} className={`border-l-2 border-amber-800/40 pl-2 ${toneClass[entry.tone] ?? toneClass.info}`}>
            {entry.text}
          </li>
        ))}
        <li ref={endRef} aria-hidden="true" />
      </ol>
    </section>
  );
}
