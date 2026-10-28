import { useState } from 'react';

const PLAYER_DOT = {
  Red: 'bg-seat-red shadow-[0_0_8px_var(--color-seat-red-glow)]',
  Blue: 'bg-seat-blue shadow-[0_0_8px_var(--color-seat-blue-glow)]',
  Orange: 'bg-seat-orange shadow-[0_0_8px_var(--color-seat-orange-glow)]',
  White: 'bg-seat-white shadow-[0_0_8px_var(--color-seat-white-glow)]',
};

const inputClass =
  'w-full rounded-lg border border-amber-700/50 bg-ink-900 px-3 py-2 text-sm text-parchment-50 placeholder:text-parchment-300/60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-200 disabled:opacity-50';

const primaryButton =
  'rounded-lg bg-gradient-to-b from-amber-200 to-amber-400 px-4 py-2 font-display text-sm font-bold tracking-wide text-ink-900 shadow-lg ring-1 ring-amber-100/70 transition-all hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-50';

const secondaryButton =
  'rounded-lg border border-amber-100/40 px-4 py-2 text-sm font-semibold text-parchment-50 transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50';

/** Landing page: pick a name, then create a room or join one by code. */
export function LandingPage({ onCreate, onJoin, disabled, error }) {
  const [name, setName] = useState(() => localStorage.getItem('catan.name') ?? '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const remember = () => localStorage.setItem('catan.name', name.trim());
  const ready = !disabled && !busy && name.trim().length > 0;

  const run = async (fn) => {
    setBusy(true);
    remember();
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex h-[100dvh] min-h-[100dvh] w-[100dvw] items-center justify-center overflow-y-auto border border-amber-700/50 bg-gray-900/90 p-[max(1.5rem,env(safe-area-inset-top))_max(1.5rem,env(safe-area-inset-right))_max(1.5rem,env(safe-area-inset-bottom))_max(1.5rem,env(safe-area-inset-left))] backdrop-blur-md">
      <section className="w-full max-w-sm rounded-2xl bg-gray-900/70 ring-1 ring-amber-800/40 p-6 shadow-2xl ring-1 ring-amber-700/50">
        <h1 className="text-center text-3xl font-bold tracking-tight text-parchment-50">Catan</h1>
        <p className="mt-1 text-center text-sm text-parchment-200">Play with friends over the network</p>

        <label className="mt-6 flex flex-col gap-1 text-xs text-parchment-200">
          Your name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="e.g. Aviv"
            disabled={disabled || busy}
            className={inputClass}
            autoFocus
          />
        </label>

        <button type="button" onClick={() => run(() => onCreate(name.trim()))} disabled={!ready} className={`${primaryButton} mt-4 w-full`}>
          Create new game
        </button>

        <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-parchment-300/60">
          <span className="h-px flex-1 bg-gray-800" />
          or
          <span className="h-px flex-1 bg-gray-800" />
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready && code.trim()) run(() => onJoin(code.trim().toUpperCase(), name.trim()));
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={4}
            placeholder="ROOM CODE"
            disabled={disabled || busy}
            className={`${inputClass} font-mono uppercase tracking-widest`}
            aria-label="Room code"
          />
          <button type="submit" disabled={!ready || code.trim().length < 4} className={secondaryButton}>
            Join
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-500/90 px-3 py-1.5 text-center text-sm text-white">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}

/** Waiting room: shows the seated players; the host can start once enough have joined. */
export function WaitingRoom({ room, myPlayerId, onStart, onLeave, onAddBot, onRemoveBot, disabled }) {
  const [noSevens, setNoSevens] = useState(false);
  const isHost = room.hostPlayerId === myPlayerId;
  const count = room.players.length;
  const enough = count >= room.minPlayers;
  const hasEmptySeat = count < room.maxPlayers;

  const copyCode = () => navigator.clipboard?.writeText(room.roomId).catch(() => {});

  return (
    <main className="flex h-[100dvh] min-h-[100dvh] w-[100dvw] items-center justify-center overflow-y-auto border border-amber-700/50 bg-gray-900/90 p-[max(1.5rem,env(safe-area-inset-top))_max(1.5rem,env(safe-area-inset-right))_max(1.5rem,env(safe-area-inset-bottom))_max(1.5rem,env(safe-area-inset-left))] backdrop-blur-md">
      <section className="w-full max-w-md rounded-2xl bg-gray-900/70 ring-1 ring-amber-800/40 p-6 shadow-2xl ring-1 ring-amber-700/50">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-parchment-300/80">Room code</p>
        <button
          type="button"
          onClick={copyCode}
          title="Click to copy"
          className="mx-auto mt-1 block rounded-lg bg-ink-900 px-6 py-2 font-mono text-4xl font-bold tracking-[0.4em] text-parchment-50 hover:bg-sky-950"
        >
          {room.roomId}
        </button>
        <p className="mt-2 text-center text-xs text-parchment-300/80">Share this code so friends can join</p>

        <h2 className="mt-6 text-xs font-semibold uppercase tracking-wide text-parchment-300/80">
          Players ({count}/{room.maxPlayers})
        </h2>
        <ul className="mt-2 flex flex-col gap-2">
          {room.players.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-lg bg-black/30 ring-1 ring-amber-900/30 px-3 py-2 text-sm text-parchment-50">
              <span className="flex items-center gap-2">
                <span className={`inline-block size-3 rounded-full ${PLAYER_DOT[p.color] ?? 'bg-stone-400'}`} />
                <span className={p.id === myPlayerId ? 'font-bold' : ''}>{p.name}</span>
                {p.id === myPlayerId && <span className="text-xs text-parchment-300/80">(you)</span>}
              </span>
              <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide">
                {p.isHost && <span className="rounded bg-amber-200 px-1.5 py-0.5 text-stone-900">Host</span>}
                {p.isBot && <span className="rounded bg-violet-700 px-1.5 py-0.5 text-violet-50">Bot</span>}
                {!p.isConnected && <span className="rounded bg-rose-600 px-1.5 py-0.5 text-rose-50">Away</span>}
                {p.isBot && isHost && (
                  <button
                    type="button"
                    onClick={() => onRemoveBot(p.id)}
                    disabled={disabled}
                    title="Remove bot"
                    className="rounded border border-amber-100/30 px-1.5 py-0.5 text-parchment-200 transition hover:bg-rose-900/60 hover:text-rose-50 disabled:opacity-50"
                  >
                    &times;
                  </button>
                )}
              </span>
            </li>
          ))}
          {Array.from({ length: room.maxPlayers - count }).map((_, i) => (
            <li key={`empty-${i}`} className="rounded-lg border border-dashed border-amber-700/50 px-3 py-2 text-sm text-sky-500">
              Waiting for player...
            </li>
          ))}
        </ul>

        {isHost ? (
          <>
            <button
              type="button"
              onClick={onAddBot}
              disabled={disabled || !hasEmptySeat}
              className={`${secondaryButton} mt-3 w-full border-violet-400/40 hover:bg-violet-950/60`}
            >
              {hasEmptySeat ? '+ Add Bot (computer player)' : 'All seats are taken'}
            </button>
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-parchment-50">
              <input type="checkbox" checked={noSevens} onChange={(e) => setNoSevens(e.target.checked)} className="size-4 accent-amber-200" />
              No 7s (robber only via Knights)
            </label>
            <button type="button" onClick={() => onStart(!noSevens)} disabled={disabled || !enough} className={`${primaryButton} mt-4 w-full`}>
              {enough ? 'Start game' : `Need ${room.minPlayers - count} more player${room.minPlayers - count === 1 ? '' : 's'}`}
            </button>
          </>
        ) : (
          <p className="mt-4 text-center text-sm text-parchment-200">Waiting for the host to start...</p>
        )}

        <button type="button" onClick={onLeave} className={`${secondaryButton} mt-3 w-full`}>
          Leave room
        </button>
      </section>
    </main>
  );
}

