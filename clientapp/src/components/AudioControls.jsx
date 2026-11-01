import { useEffect, useRef, useState } from 'react';
import { music } from '../music';
import { sound } from '../audio';
import { haptics } from '../haptics';
import { MusicIcon, SoundOffIcon, SoundOnIcon } from './icons';

const rowButton =
  'flex w-full items-center justify-between gap-3 rounded-lg border px-2.5 py-1.5 text-left font-display text-[11px] font-bold uppercase tracking-wider transition';

const onRow = 'border-amber-300/70 bg-amber-400/15 text-amber-100';
const offRow = 'border-amber-900/50 bg-black/30 text-parchment-300/70 hover:border-amber-700';

/**
 * The one place the table's sound lives: background music on/off and its volume, the
 * sound-effects mute, and (on a phone) haptics.
 *
 * It is a single small button that opens a panel, rather than a row of toggles, because it
 * has to sit on screen the whole game without competing with anything that matters. Every
 * preference is persisted by the module behind it, so a reload comes back the way the
 * player left it.
 */
export default function AudioControls({ className = '' }) {
  const [open, setOpen] = useState(false);
  const [musicOn, setMusicOn] = useState(music.enabled);
  const [volume, setVolume] = useState(music.volume);
  const [muted, setMuted] = useState(sound.muted);
  const [buzz, setBuzz] = useState(haptics.enabled);
  const panelRef = useRef(null);

  useEffect(
    () =>
      music.subscribe((state) => {
        setMusicOn(state.enabled);
        setVolume(state.volume);
      }),
    [],
  );
  useEffect(() => sound.subscribe(setMuted), []);
  useEffect(() => haptics.subscribe(setBuzz), []);

  // Click away or press Escape to put the panel away again.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (!panelRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const everythingOff = muted && !musicOn;

  return (
    <div ref={panelRef} className={`pointer-events-auto relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Music and sound"
        aria-label="Music and sound"
        aria-expanded={open}
        className={`flex size-9 items-center justify-center rounded-lg border shadow-xl backdrop-blur-md transition-all hover:scale-110 max-md:size-8 ${
          open
            ? 'border-amber-300 bg-amber-400/90 text-ink-900'
            : 'border-amber-700/50 bg-gray-900/85 text-parchment-100 hover:border-amber-400'
        }`}
      >
        <MusicIcon className={`size-4.5 max-md:size-4 ${musicOn && !open ? 'animate-note-sway' : ''}`} />
        {everythingOff && (
          <span
            aria-hidden="true"
            className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border border-gray-900 bg-rose-500"
          />
        )}
      </button>

      {open && (
        <div
          className="animate-fade-in absolute right-0 top-[calc(100%+0.4rem)] z-10 w-52 rounded-xl border border-amber-700/50 bg-gray-950/92 p-2.5 shadow-2xl backdrop-blur-md"
          role="group"
          aria-label="Sound settings"
        >
          <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-[0.25em] text-amber-300/80">
            Sound
          </p>

          <button
            type="button"
            onClick={() => music.toggle()}
            aria-pressed={musicOn}
            className={`${rowButton} ${musicOn ? onRow : offRow}`}
          >
            <span>Music</span>
            <span className={musicOn ? 'text-amber-300' : 'text-parchment-300/50'}>
              {musicOn ? 'on' : 'off'}
            </span>
          </button>

          <label className="mt-2 block">
            <span className="mb-1 flex items-center justify-between font-display text-[10px] font-bold uppercase tracking-wider text-parchment-300/70">
              Volume
              <span className="font-mono tabular-nums">{Math.round(volume * 100)}%</span>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(volume * 100)}
              onChange={(e) => music.setVolume(Number(e.target.value) / 100)}
              aria-label="Music volume"
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-black/60 accent-amber-300 ring-1 ring-amber-900/50"
            />
          </label>

          <button
            type="button"
            onClick={() => sound.toggleMuted()}
            aria-pressed={!muted}
            className={`${rowButton} mt-2.5 ${muted ? offRow : onRow}`}
          >
            <span className="flex items-center gap-1.5">
              {muted ? <SoundOffIcon className="size-3.5" /> : <SoundOnIcon className="size-3.5" />}
              Effects
            </span>
            <span className={muted ? 'text-parchment-300/50' : 'text-amber-300'}>
              {muted ? 'muted' : 'on'}
            </span>
          </button>

          {/* Only worth offering where the device can actually buzz. */}
          {haptics.available && (
            <button
              type="button"
              onClick={() => haptics.toggle()}
              aria-pressed={buzz}
              className={`${rowButton} mt-2 ${buzz ? onRow : offRow}`}
            >
              <span>Vibration</span>
              <span className={buzz ? 'text-amber-300' : 'text-parchment-300/50'}>{buzz ? 'on' : 'off'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
