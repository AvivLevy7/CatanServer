import { useState } from 'react';

const PLAYER_DOT = {
  Red: 'bg-red-500',
  Blue: 'bg-blue-500',
  Orange: 'bg-orange-500',
  White: 'bg-stone-100',
};

const inputClass =
  'w-full rounded-lg border border-sky-600 bg-sky-900 px-3 py-2 text-sm text-amber-50 placeholder:text-sky-400 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-200 disabled:opacity-50';

const primaryButton =
  'rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold text-stone-900 shadow transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50';

const secondaryButton =
  'rounded-lg border border-amber-100/40 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50';

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
    <main className="flex min-h-svh items-center justify-center bg-sky-900 p-6">
      <section className="w-full max-w-sm rounded-2xl bg-sky-800/70 p-6 shadow-2xl ring-1 ring-sky-700">
        <h1 className="text-center text-3xl font-bold tracking-tight text-amber-50">Catan</h1>
        <p className="mt-1 text-center text-sm text-sky-200">Play with friends over the network</p>

        <label className="mt-6 flex flex-col gap-1 text-xs text-sky-200">
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

        <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-sky-400">
          <span className="h-px flex-1 bg-sky-700" />
          or
          <span className="h-px flex-1 bg-sky-700" />
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
export function WaitingRoom({ room, myPlayerId, onStart, onLeave, disabled }) {
  const [noSevens, setNoSevens] = useState(false);
  const isHost = room.hostPlayerId === myPlayerId;
  const count = room.players.length;
  const enough = count >= room.minPlayers;

  const copyCode = () => navigator.clipboard?.writeText(room.roomId).catch(() => {});

  return (
    <main className="flex min-h-svh items-center justify-center bg-sky-900 p-6">
      <section className="w-full max-w-md rounded-2xl bg-sky-800/70 p-6 shadow-2xl ring-1 ring-sky-700">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-sky-300">Room code</p>
        <button
          type="button"
          onClick={copyCode}
          title="Click to copy"
          className="mx-auto mt-1 block rounded-lg bg-sky-900 px-6 py-2 font-mono text-4xl font-bold tracking-[0.4em] text-amber-50 hover:bg-sky-950"
        >
          {room.roomId}
        </button>
        <p className="mt-2 text-center text-xs text-sky-300">Share this code so friends can join</p>

        <h2 className="mt-6 text-xs font-semibold uppercase tracking-wide text-sky-300">
          Players ({count}/{room.maxPlayers})
        </h2>
        <ul className="mt-2 flex flex-col gap-2">
          {room.players.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-lg bg-sky-900/60 px-3 py-2 text-sm text-amber-50">
              <span className="flex items-center gap-2">
                <span className={`inline-block size-3 rounded-full ${PLAYER_DOT[p.color] ?? 'bg-stone-400'}`} />
                <span className={p.id === myPlayerId ? 'font-bold' : ''}>{p.name}</span>
                {p.id === myPlayerId && <span className="text-xs text-sky-300">(you)</span>}
              </span>
              <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide">
                {p.isHost && <span className="rounded bg-amber-200 px-1.5 py-0.5 text-stone-900">Host</span>}
                {!p.isConnected && <span className="rounded bg-rose-600 px-1.5 py-0.5 text-rose-50">Away</span>}
              </span>
            </li>
          ))}
          {Array.from({ length: room.maxPlayers - count }).map((_, i) => (
            <li key={`empty-${i}`} className="rounded-lg border border-dashed border-sky-700 px-3 py-2 text-sm text-sky-500">
              Waiting for player...
            </li>
          ))}
        </ul>

        {isHost ? (
          <>
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-amber-50">
              <input type="checkbox" checked={noSevens} onChange={(e) => setNoSevens(e.target.checked)} className="size-4 accent-amber-200" />
              No 7s (robber only via Knights)
            </label>
            <button type="button" onClick={() => onStart(!noSevens)} disabled={disabled || !enough} className={`${primaryButton} mt-4 w-full`}>
              {enough ? 'Start game' : `Need ${room.minPlayers - count} more player${room.minPlayers - count === 1 ? '' : 's'}`}
            </button>
          </>
        ) : (
          <p className="mt-4 text-center text-sm text-sky-200">Waiting for the host to start...</p>
        )}

        <button type="button" onClick={onLeave} className={`${secondaryButton} mt-3 w-full`}>
          Leave room
        </button>
      </section>
    </main>
  );
}
