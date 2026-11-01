import { useEffect, useRef, useState } from 'react';
import { seat } from '../theme';
import { CheckIcon, CrownIcon, ExitIcon, MinusIcon, PlusIcon, UnplugIcon } from './icons';

const CODE_LENGTH = 4;

// One human plus this many computer players fills the table.
const MAX_BOTS = 3;

const inputClass =
  'w-full rounded-xl border border-amber-700/50 bg-black/45 px-3.5 py-2.5 font-body text-base text-parchment-50 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] outline-none transition placeholder:text-parchment-300/40 focus:border-amber-300/80 focus:shadow-[inset_0_2px_8px_rgba(0,0,0,0.5),0_0_0_3px_rgba(245,190,90,0.18)] disabled:opacity-50';

const primaryButton =
  'w-full rounded-xl bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500 px-4 py-2.5 font-display text-sm font-black uppercase tracking-[0.18em] text-ink-900 shadow-[0_10px_24px_-8px_rgba(245,190,90,0.7)] ring-1 ring-amber-100/80 transition-all hover:scale-[1.02] hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:scale-100';

const ghostButton =
  'rounded-xl border border-amber-600/50 bg-black/35 px-4 py-2.5 font-display text-sm font-bold uppercase tracking-[0.14em] text-parchment-100 transition-all hover:border-amber-300 hover:bg-black/55 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40';

const stepperButton =
  'flex size-8 shrink-0 items-center justify-center rounded-lg border border-amber-700/50 bg-black/40 text-parchment-100 transition hover:border-amber-300 hover:text-amber-200 disabled:opacity-30 disabled:hover:border-amber-700/50';

/**
 * The screen behind every lobby view: the tavern table, a warm pool of light over the
 * middle of it, and the crest at the top. Shared so the landing page and the waiting room
 * are unmistakably the same place.
 */
function LobbyShell({ children, footer }) {
  return (
    <main className="bg-tavern lobby-stage relative flex h-[100dvh] min-h-[100dvh] w-[100dvw] flex-col items-center justify-center overflow-y-auto p-[max(1.25rem,env(safe-area-inset-top))_max(1.25rem,env(safe-area-inset-right))_max(1.25rem,env(safe-area-inset-bottom))_max(1.25rem,env(safe-area-inset-left))]">
      <div className="animate-hud-rise relative z-10 flex w-full max-w-md flex-col items-stretch gap-5">
        <Crest />
        {children}
        {footer}
      </div>
    </main>
  );
}

/** Title block: the game's own name, set rather than printed. */
function Crest() {
  return (
    <header className="text-center">
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.55em] text-amber-300/70">
        Settlers of
      </p>
      <h1 className="title-engraved font-display text-[2.75rem] font-black uppercase leading-none tracking-[0.12em] max-md:text-4xl">
        Catan
      </h1>
      <div className="rule-gold mx-auto mt-3 w-40" />
      <p className="mt-3 font-body text-sm italic text-parchment-200/85">
        Trade, build, settle &mdash; with friends or against the machines.
      </p>
    </header>
  );
}

/** Glass card the whole lobby is built out of. */
function Panel({ children, className = '' }) {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-amber-700/45 bg-gray-950/55 p-5 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md max-md:p-4 ${className}`}
    >
      {/* Light catching the top edge of the glass. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/50 to-transparent"
      />
      {children}
    </section>
  );
}

function FieldLabel({ children, hint }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <span className="font-display text-[10px] font-bold uppercase tracking-[0.25em] text-amber-300/80">
        {children}
      </span>
      {hint && <span className="font-body text-[11px] italic text-parchment-300/60">{hint}</span>}
    </div>
  );
}

/**
 * Four character cells for the join code. One real (invisible) input sits over them and
 * does all the work - typing, pasting, backspace and the mobile keyboard - so the cells
 * stay purely presentational and nothing has to be kept in sync.
 */
function RoomCodeInput({ value, onChange, onSubmit, disabled }) {
  const inputRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const cells = Array.from({ length: CODE_LENGTH }, (_, i) => value[i] ?? '');
  const caret = Math.min(value.length, CODE_LENGTH - 1);

  return (
    <div className="relative">
      <div className="flex gap-2" aria-hidden="true">
        {cells.map((char, i) => (
          <span
            key={i}
            className={`flex h-14 flex-1 items-center justify-center rounded-xl border bg-black/45 font-display text-2xl font-black text-parchment-50 shadow-[inset_0_2px_8px_rgba(0,0,0,0.55)] transition-all max-md:h-12 max-md:text-xl ${
              focused && i === caret
                ? 'border-amber-300/90 shadow-[inset_0_2px_8px_rgba(0,0,0,0.55),0_0_0_3px_rgba(245,190,90,0.2)]'
                : char
                  ? 'border-amber-600/60'
                  : 'border-amber-800/40'
            }`}
          >
            {char || (focused && i === caret ? <span className="animate-pulse text-amber-300/70">|</span> : '')}
          </span>
        ))}
      </div>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, CODE_LENGTH))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit?.();
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxLength={CODE_LENGTH}
        disabled={disabled}
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck="false"
        aria-label="Room code"
        className="absolute inset-0 w-full cursor-pointer rounded-xl bg-transparent text-transparent caret-transparent outline-none"
      />
    </div>
  );
}

/** − n + control for how many computer players to bring along. */
function BotStepper({ count, max, onChange, disabled }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(count - 1)}
        disabled={disabled || count <= 0}
        aria-label="One fewer computer player"
        className={stepperButton}
      >
        <MinusIcon className="size-4" />
      </button>

      <div className="flex flex-1 items-center justify-center gap-1.5">
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`h-2 flex-1 rounded-full transition-all ${
              i < count ? 'bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.7)]' : 'bg-black/50 ring-1 ring-amber-900/40'
            }`}
          />
        ))}
      </div>

      <span className="w-7 text-center font-display text-base font-black tabular-nums text-parchment-50">
        {count}
      </span>

      <button
        type="button"
        onClick={() => onChange(count + 1)}
        disabled={disabled || count >= max}
        aria-label="One more computer player"
        className={stepperButton}
      >
        <PlusIcon className="size-4" />
      </button>
    </div>
  );
}

/** Landing page: name yourself, bring bots, then open a table or join one by code. */
export function LandingPage({
  onCreate,
  onJoin,
  disabled,
  error,
  resumable,
  onResume,
  onDismissResume,
}) {
  const [name, setName] = useState(() => localStorage.getItem('catan.name') ?? '');
  const [code, setCode] = useState('');
  const [bots, setBots] = useState(() => {
    const saved = Number.parseInt(localStorage.getItem('catan.bots') ?? '', 10);
    return Number.isInteger(saved) ? Math.min(MAX_BOTS, Math.max(0, saved)) : 0;
  });
  const [busy, setBusy] = useState(false);

  const trimmed = name.trim();
  const ready = !disabled && !busy && trimmed.length > 0;
  const canJoin = ready && code.length === CODE_LENGTH;

  const run = async (fn) => {
    setBusy(true);
    localStorage.setItem('catan.name', trimmed);
    localStorage.setItem('catan.bots', String(bots));
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const setBotCount = (next) => setBots(Math.min(MAX_BOTS, Math.max(0, next)));

  return (
    <LobbyShell
      footer={
        <p className="text-center font-body text-[11px] text-parchment-300/50">
          A table needs three players. Bots fill any seat nobody takes.
        </p>
      }
    >
      {/* A seat this browser left behind, which another tab is still sitting in. */}
      {resumable && (
        <Panel className="border-emerald-500/40 bg-emerald-950/40">
          <p className="font-body text-sm text-emerald-50">
            You have a seat at table{' '}
            <span className="font-display font-black tracking-[0.2em] text-emerald-200">{resumable.roomId}</span>.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onResume}
              disabled={disabled || busy}
              className={`${ghostButton} flex-1 border-emerald-400/60 text-emerald-50 hover:border-emerald-300`}
            >
              Take it back
            </button>
            <button
              type="button"
              onClick={onDismissResume}
              aria-label="Forget that seat"
              title="Forget that seat"
              className={`${ghostButton} px-3`}
            >
              <ExitIcon className="size-4" />
            </button>
          </div>
        </Panel>
      )}

      <Panel>
        <div>
          <FieldLabel>Your name</FieldLabel>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && ready) run(() => onCreate(trimmed, bots));
            }}
            maxLength={20}
            placeholder="Who is settling?"
            disabled={disabled || busy}
            className={inputClass}
            autoFocus
          />
        </div>

        <div className="mt-4">
          <FieldLabel hint={bots === 0 ? 'humans only' : `${bots} will be seated`}>Computer players</FieldLabel>
          <BotStepper count={bots} max={MAX_BOTS} onChange={setBotCount} disabled={disabled || busy} />
        </div>

        <button
          type="button"
          onClick={() => run(() => onCreate(trimmed, bots))}
          disabled={!ready}
          className={`${primaryButton} mt-5`}
        >
          {busy ? 'Opening table…' : 'Open a table'}
        </button>
      </Panel>

      <div className="flex items-center gap-3 font-display text-[10px] font-bold uppercase tracking-[0.4em] text-parchment-300/40">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-800/60" />
        or
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-800/60" />
      </div>

      <Panel>
        <FieldLabel hint="4 characters">Join with a code</FieldLabel>
        <RoomCodeInput
          value={code}
          onChange={setCode}
          onSubmit={() => canJoin && run(() => onJoin(code, trimmed))}
          disabled={disabled || busy}
        />
        <button
          type="button"
          onClick={() => run(() => onJoin(code, trimmed))}
          disabled={!canJoin}
          className={`${ghostButton} mt-3 w-full`}
        >
          Join the table
        </button>
      </Panel>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-400/60 bg-rose-950/80 px-3.5 py-2 text-center font-body text-sm text-rose-100 shadow-xl backdrop-blur"
        >
          {error}
        </p>
      )}
    </LobbyShell>
  );
}

/** One seated player (or an empty chair) in the waiting room. */
function SeatRow({ player, isMe, isHost, onRemoveBot, disabled }) {
  if (!player) {
    return (
      <li className="flex h-[3.25rem] items-center justify-center rounded-xl border border-dashed border-amber-800/45 font-body text-[13px] italic text-parchment-300/45">
        Empty chair
      </li>
    );
  }

  const s = seat(player.color);

  return (
    <li
      className={`relative flex h-[3.25rem] items-center gap-3 overflow-hidden rounded-xl border bg-black/35 pl-4 pr-2.5 ${
        isMe ? 'border-amber-400/70 shadow-[0_0_18px_-4px_rgba(245,190,90,0.45)]' : 'border-amber-900/50'
      }`}
    >
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${s.gradient}`} />
      <span className={`inline-block size-3 shrink-0 rounded-full ring-1 ring-black/50 ${s.dot}`} />

      <span className="min-w-0 flex-1">
        <span
          className={`block truncate font-display text-sm font-bold tracking-wide ${
            isMe ? 'text-amber-100' : 'text-parchment-50'
          }`}
        >
          {player.name}
          {isMe && <span className="ml-1.5 font-body text-[11px] not-italic text-parchment-300/70">(you)</span>}
        </span>
        <span className="block font-body text-[11px] text-parchment-300/60">{s.label}</span>
      </span>

      <span className="flex shrink-0 items-center gap-1.5">
        {player.isHost && (
          <span
            title="Host"
            className="flex items-center gap-1 rounded-md bg-amber-300/90 px-1.5 py-0.5 font-display text-[9px] font-black uppercase tracking-wider text-ink-900"
          >
            <CrownIcon className="size-3" />
            Host
          </span>
        )}
        {player.isBot && (
          <span className="rounded-md bg-violet-600/90 px-1.5 py-0.5 font-display text-[9px] font-black uppercase tracking-wider text-violet-50">
            Bot
          </span>
        )}
        {!player.isConnected && !player.isBot && (
          <span
            title="Not connected"
            className="flex items-center gap-1 rounded-md bg-rose-700/90 px-1.5 py-0.5 font-display text-[9px] font-black uppercase tracking-wider text-rose-50"
          >
            <UnplugIcon className="size-3" />
            Away
          </span>
        )}
        {player.isBot && isHost && (
          <button
            type="button"
            onClick={() => onRemoveBot(player.id)}
            disabled={disabled}
            title={`Remove ${player.name}`}
            aria-label={`Remove ${player.name}`}
            className="flex size-7 items-center justify-center rounded-lg border border-amber-800/60 text-parchment-300 transition hover:border-rose-400 hover:bg-rose-900/50 hover:text-rose-100 disabled:opacity-40"
          >
            <MinusIcon className="size-3.5" />
          </button>
        )}
      </span>
    </li>
  );
}

/** Waiting room: who is at the table, and the host's controls to get going. */
export function WaitingRoom({ room, myPlayerId, onStart, onLeave, onAddBot, onRemoveBot, disabled }) {
  const [noSevens, setNoSevens] = useState(false);
  const [copied, setCopied] = useState(false);

  const isHost = room.hostPlayerId === myPlayerId;
  const count = room.players.length;
  const bots = room.players.filter((p) => p.isBot).length;
  const enough = count >= room.minPlayers;
  const emptySeats = room.maxPlayers - count;
  const missing = Math.max(0, room.minPlayers - count);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyCode = async () => {
    try {
      await navigator.clipboard?.writeText(room.roomId);
      setCopied(true);
    } catch {
      /* clipboard refused (insecure context): the code is on screen anyway */
    }
  };

  // The stepper drives the real bot seats, one hub call per step.
  const setBotCount = (next) => {
    if (next > bots && emptySeats > 0) {
      onAddBot();
      return;
    }
    if (next < bots) {
      const last = [...room.players].reverse().find((p) => p.isBot);
      if (last) onRemoveBot(last.id);
    }
  };

  return (
    <LobbyShell>
      <Panel>
        <FieldLabel hint={copied ? 'copied!' : 'tap to copy'}>Table code</FieldLabel>
        <button
          type="button"
          onClick={copyCode}
          title="Copy the code"
          className={`group flex w-full items-center justify-center gap-2 rounded-xl border bg-black/45 py-3 shadow-[inset_0_2px_10px_rgba(0,0,0,0.55)] transition ${
            copied ? 'border-emerald-400/70' : 'border-amber-700/50 hover:border-amber-300'
          }`}
        >
          <span className="font-display text-4xl font-black tracking-[0.35em] text-parchment-50 max-md:text-3xl">
            {room.roomId}
          </span>
          {copied && <CheckIcon className="size-5 text-emerald-300" />}
        </button>
        <p className="mt-2 text-center font-body text-[11px] text-parchment-300/60">
          Share it and your friends can walk straight in.
        </p>
      </Panel>

      <Panel>
        <FieldLabel hint={`${count}/${room.maxPlayers}`}>At the table</FieldLabel>
        <ul className="flex flex-col gap-2">
          {room.players.map((player) => (
            <SeatRow
              key={player.id}
              player={player}
              isMe={player.id === myPlayerId}
              isHost={isHost}
              onRemoveBot={onRemoveBot}
              disabled={disabled}
            />
          ))}
          {Array.from({ length: emptySeats }, (_, i) => (
            <SeatRow key={`empty-${i}`} player={null} />
          ))}
        </ul>

        {isHost && (
          <>
            <div className="mt-4 border-t border-amber-900/40 pt-4">
              <FieldLabel hint={emptySeats === 0 ? 'table full' : `${emptySeats} chair${emptySeats === 1 ? '' : 's'} free`}>
                Computer players
              </FieldLabel>
              {/* The ceiling is what is actually free: the bots already seated plus the
                  empty chairs, so the + never offers a seat that does not exist. */}
              <BotStepper count={bots} max={bots + emptySeats} onChange={setBotCount} disabled={disabled} />
            </div>

            <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-amber-900/50 bg-black/30 px-3.5 py-2.5">
              <span className="min-w-0">
                <span className="block font-display text-xs font-bold tracking-wide text-parchment-50">
                  No sevens
                </span>
                <span className="block font-body text-[11px] text-parchment-300/60">
                  The robber only moves on a Knight.
                </span>
              </span>
              <input
                type="checkbox"
                checked={noSevens}
                onChange={(e) => setNoSevens(e.target.checked)}
                className="size-5 shrink-0 accent-amber-300"
              />
            </label>
          </>
        )}
      </Panel>

      {isHost ? (
        <button
          type="button"
          onClick={() => onStart(!noSevens)}
          disabled={disabled || !enough}
          className={primaryButton}
        >
          {enough ? 'Begin the game' : `Need ${missing} more player${missing === 1 ? '' : 's'}`}
        </button>
      ) : (
        <p className="rounded-xl border border-amber-800/40 bg-black/30 px-4 py-3 text-center font-body text-sm italic text-parchment-200/85">
          Waiting for the host to begin…
        </p>
      )}

      <button type="button" onClick={onLeave} className={`${ghostButton} w-full`}>
        Leave the table
      </button>
    </LobbyShell>
  );
}
