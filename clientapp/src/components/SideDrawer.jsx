import { useEffect, useRef, useState } from 'react';
import GameLog from './GameLog';
import DiceStatsChart from './DiceStatsChart';
import { seat } from '../theme';
import { sound } from '../audio';
import { ChartIcon, ChatIcon, ScrollIcon, SoundOffIcon, SoundOnIcon } from './icons';

const TABS = [
  { id: 'log', label: 'Game Log', icon: ScrollIcon },
  { id: 'chat', label: 'Chat', icon: ChatIcon },
  { id: 'stats', label: 'Dice Stats', icon: ChartIcon },
];

function ChatPanel({ messages, players, myPlayerId, onSend, disabled }) {
  const [draft, setDraft] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  const colorOf = (id) => seat(players.find((p) => p.id === id)?.color).text;

  const submit = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  };

  return (
    <section aria-label="Chat" className="flex min-h-0 flex-1 flex-col">
      <h2 className="mb-2 font-display text-[11px] font-bold uppercase tracking-[0.25em] text-amber-300/90">Tavern Talk</h2>
      <div className="rule-gold mb-3" aria-hidden="true" />
      <ol className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1 text-sm leading-snug">
        {messages.length === 0 && <li className="text-xs italic text-parchment-300/70">No one has spoken yet.</li>}
        {messages.map((m) => (
          <li key={m.id} className={`rounded-lg px-2.5 py-1.5 ${m.senderId === myPlayerId ? 'bg-amber-900/25' : 'bg-black/25'}`}>
            <span className={`font-display text-xs font-bold ${colorOf(m.senderId)}`}>{m.senderName}</span>
            <span className="ml-2 text-parchment-100">{m.text}</span>
          </li>
        ))}
        <li ref={endRef} aria-hidden="true" />
      </ol>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={280}
          placeholder="Say something..."
          disabled={disabled}
          className="min-w-0 flex-1 rounded-lg border border-amber-700/50 bg-ink-900 px-3 py-2 text-sm text-parchment-50 placeholder:text-parchment-300/50 focus-visible:outline-2 focus-visible:outline-amber-200 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !draft.trim()}
          className="rounded-lg bg-gradient-to-b from-amber-200 to-amber-400 px-3 font-display text-xs font-bold text-ink-900 shadow transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
        >
          Send
        </button>
      </form>
    </section>
  );
}

/**
 * Floating action rail on the left edge plus a slide-out glass drawer (the right edge
 * belongs to the action dock). Badges light up when a tab receives new content while it
 * is not the open one.
 */
export default function SideDrawer({ log, chatMessages, players, myPlayerId, onSendChat, frequencies, disabled }) {
  const [open, setOpen] = useState(null);
  const [muted, setMuted] = useState(sound.muted);
  // Counts seen per tab; a badge shows when the live count exceeds the seen count.
  const [seen, setSeen] = useState({ log: 0, chat: 0, stats: 0 });

  useEffect(() => sound.subscribe(setMuted), []);

  const rollsSoFar = Object.values(frequencies ?? {}).reduce((a, b) => a + b, 0);
  const counts = { log: log.length, chat: chatMessages.length, stats: rollsSoFar };

  // The open tab is always "read"; everything else badges once its count outgrows what was last seen.
  const isUnread = (id) => id !== open && counts[id] > seen[id];

  const close = () => {
    setOpen((cur) => {
      if (cur) setSeen((s) => ({ ...s, [cur]: counts[cur] }));
      return null;
    });
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts.log, counts.chat, counts.stats]);

  const toggle = (id) => {
    if (open === id) {
      close();
      return;
    }
    setSeen((s) => ({ ...s, [id]: counts[id], ...(open ? { [open]: counts[open] } : {}) }));
    setOpen(id);
  };

  return (
    <>
      {/* Floating rail */}
      <nav
        aria-label="Side panels"
        className={`pointer-events-none fixed left-3 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-2 transition-transform duration-300 max-md:left-[max(0.375rem,env(safe-area-inset-left))] max-md:gap-1 ${
          open ? 'translate-x-80 max-md:translate-x-64' : ''
        }`}
      >
        {TABS.map((tab) => {
          const unread = isUnread(tab.id);
          const active = open === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => toggle(tab.id)}
              title={tab.label}
              aria-label={tab.label}
              aria-pressed={active}
              className={`pointer-events-auto relative flex size-12 items-center justify-center rounded-xl border shadow-xl backdrop-blur-md transition-all hover:scale-110 max-md:size-9 max-md:rounded-lg ${
                active
                  ? 'border-amber-300 bg-amber-400/90 text-ink-900 shadow-amber-500/40'
                  : 'border-amber-700/50 bg-gray-900/85 text-parchment-100 hover:border-amber-400'
              }`}
            >
              <tab.icon className="size-5 max-md:size-4" />
              {unread && !active && (
                <span className="absolute -right-1 -top-1 flex size-3.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex size-3.5 rounded-full border border-rose-200 bg-rose-500" />
                </span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => sound.toggleMuted()}
          title={muted ? 'Unmute sounds' : 'Mute sounds'}
          aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
          className="pointer-events-auto flex size-12 items-center justify-center rounded-xl border border-amber-700/50 bg-gray-900/85 text-parchment-100 shadow-xl backdrop-blur-md transition-all hover:scale-110 hover:border-amber-400 max-md:size-9 max-md:rounded-lg"
        >
          {muted ? <SoundOffIcon className="size-5 max-md:size-4" /> : <SoundOnIcon className="size-5 max-md:size-4" />}
        </button>
      </nav>

      {/* Backdrop (click to close) */}
      {open && <div className="fixed inset-0 z-[36] bg-black/30" onClick={close} aria-hidden="true" />}

      {/* Drawer */}
      <aside
        aria-label={TABS.find((t) => t.id === open)?.label ?? 'Side panel'}
        aria-hidden={!open}
        className={`fixed left-0 top-0 z-[38] flex h-[100dvh] w-80 max-w-[85vw] flex-col border-r border-amber-700/50 bg-gray-900/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pt-[max(1rem,env(safe-area-inset-top))] shadow-2xl backdrop-blur-md transition-transform duration-300 ease-out max-md:w-64 max-md:p-3 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-md:pl-[max(0.75rem,env(safe-area-inset-left))] max-md:pt-[max(0.75rem,env(safe-area-inset-top))] ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="font-display text-sm font-bold uppercase tracking-[0.3em] text-amber-200">
            {TABS.find((t) => t.id === open)?.label ?? ''}
          </span>
          <button
            type="button"
            onClick={close}
            className="rounded px-2 py-1 text-lg leading-none text-parchment-200 hover:bg-gray-800"
            aria-label="Close panel"
          >
            &times;
          </button>
        </div>

        {open === 'log' && <GameLog entries={log} className="min-h-0 flex-1 border-0 bg-transparent p-0 shadow-none" />}
        {open === 'chat' && (
          <ChatPanel messages={chatMessages} players={players} myPlayerId={myPlayerId} onSend={onSendChat} disabled={disabled} />
        )}
        {open === 'stats' && (
          <section aria-label="Dice statistics" className="min-h-0 flex-1 overflow-y-auto">
            <h2 className="mb-2 font-display text-[11px] font-bold uppercase tracking-[0.25em] text-amber-300/90">Fortune of the Dice</h2>
            <div className="rule-gold mb-3" aria-hidden="true" />
            <DiceStatsChart frequencies={frequencies} />
          </section>
        )}
      </aside>
    </>
  );
}
