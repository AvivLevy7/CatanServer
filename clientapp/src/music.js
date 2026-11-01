/**
 * Ambient background music for the table: a slow medieval loop that sits well under the
 * game's sound effects (which live in `audio.js` and have their own mute).
 *
 * Two sources, in order of preference:
 *
 *  1. A real loop served from `/music/` (see `public/music/README.md`). Drop a
 *     royalty-free lute/tavern loop in and it is used automatically - no code change.
 *  2. Failing that, a synthesized one: a plucked-string pattern over a soft drone,
 *     scheduled bar by bar through the Web Audio API. It weighs nothing, loops forever
 *     without a seam, and means the game is never silent just because an asset is
 *     missing.
 *
 * Browsers refuse to start audio before a user gesture, so nothing is created until
 * `unlock()` is called from the first click or key press; after that the track fades in
 * rather than snapping on.
 */

// Tried in order; the first one that actually loads wins.
const FILE_SOURCES = ['/music/tavern.mp3', '/music/tavern.ogg', '/music/tavern.m4a'];

const ENABLED_KEY = 'catan.music';
const VOLUME_KEY = 'catan.musicVolume';

const FADE_SECONDS = 2.2;
const DEFAULT_VOLUME = 0.35;

// ---- Synthesized fallback -------------------------------------------------

// D Dorian, two octaves: the mode most of the lute repertoire lives in, and it stays
// consonant whichever two notes happen to overlap.
const SCALE = [146.83, 164.81, 174.61, 196.0, 220.0, 246.94, 261.63, 293.66, 329.63, 349.23, 392.0, 440.0];

// Drone root + fifth, two octaves down. Detuned a hair so they beat slowly against
// each other instead of sitting dead still.
const DRONE = [73.42, 110.0, 110.4];

// One bar of eighth notes; 0 is a rest. Indices into SCALE. Four bars, so the pattern
// takes about 20 seconds to come round - long enough not to nag.
const PHRASES = [
  [0, 3, 5, 7, null, 5, 3, null],
  [2, 5, 7, 9, null, 7, 5, null],
  [4, 7, 9, 11, null, 9, 7, 5],
  [3, 5, 2, 0, null, 2, null, null],
];

const BEAT_SECONDS = 0.62;
const LOOKAHEAD_SECONDS = 1.6;
const SCHEDULE_EVERY_MS = 400;

let enabled = localStorage.getItem(ENABLED_KEY) !== '0';
let volume = clamp01(Number.parseFloat(localStorage.getItem(VOLUME_KEY) ?? '') || DEFAULT_VOLUME);
let unlocked = false;
let playing = false;
let usingFile = false;

/** @type {HTMLAudioElement | null} */
let element = null;
/** @type {AudioContext | null} */
let ctx = null;
/** @type {GainNode | null} */
let master = null;
let droneNodes = [];
let scheduler = null;
let nextNoteTime = 0;
let step = 0;

const listeners = new Set();

function clamp01(value) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : DEFAULT_VOLUME;
}

function announce() {
  const state = { enabled, volume, available: true };
  for (const fn of listeners) fn(state);
}

// ---- File playback --------------------------------------------------------

/**
 * Resolves to a playing <audio> element, or null when no loop is served. Each candidate
 * is given one shot: `canplay` means the file is real, `error` means try the next.
 */
function tryFile(index = 0) {
  if (index >= FILE_SOURCES.length) return Promise.resolve(null);

  return new Promise((resolve) => {
    const el = new Audio(FILE_SOURCES[index]);
    el.loop = true;
    el.preload = 'auto';
    el.volume = 0;

    const cleanup = () => {
      el.removeEventListener('canplay', onReady);
      el.removeEventListener('error', onFail);
    };
    const onReady = () => {
      cleanup();
      resolve(el);
    };
    const onFail = () => {
      cleanup();
      resolve(tryFile(index + 1));
    };

    el.addEventListener('canplay', onReady, { once: true });
    el.addEventListener('error', onFail, { once: true });
    el.load();
  });
}

/** Ramps the file element's volume over `seconds`, since <audio> has no envelope of its own. */
function fadeElement(el, to, seconds) {
  const from = el.volume;
  const started = performance.now();
  const tick = () => {
    if (el !== element) return;
    const t = Math.min(1, (performance.now() - started) / (seconds * 1000));
    el.volume = clamp01(from + (to - from) * t);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---- Synthesized playback -------------------------------------------------

function audioContext() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** One plucked string: a bright attack that decays into a soft body. */
function pluck(ac, at, frequency, gain) {
  const voice = ac.createGain();
  voice.gain.setValueAtTime(0.0001, at);
  voice.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  voice.gain.exponentialRampToValueAtTime(0.0001, at + 1.9);

  const body = ac.createBiquadFilter();
  body.type = 'lowpass';
  body.frequency.setValueAtTime(2600, at);
  body.frequency.exponentialRampToValueAtTime(680, at + 1.2);
  body.Q.value = 0.8;

  voice.connect(body).connect(master);

  // Fundamental plus two quieter partials: enough overtone to read as a string
  // rather than a sine, without the cost of a real physical model.
  for (const [ratio, level, type] of [
    [1, 1, 'triangle'],
    [2, 0.3, 'sine'],
    [3.01, 0.12, 'sine'],
  ]) {
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency * ratio;
    const partial = ac.createGain();
    partial.gain.value = level;
    osc.connect(partial).connect(voice);
    osc.start(at);
    osc.stop(at + 2);
  }
}

function startDrone(ac) {
  const bed = ac.createGain();
  bed.gain.value = 0.085;

  const warmth = ac.createBiquadFilter();
  warmth.type = 'lowpass';
  warmth.frequency.value = 420;
  warmth.Q.value = 0.6;
  bed.connect(warmth).connect(master);

  // Very slow filter sweep, so the bed breathes instead of droning flat.
  const breath = ac.createOscillator();
  breath.type = 'sine';
  breath.frequency.value = 0.045;
  const depth = ac.createGain();
  depth.gain.value = 130;
  breath.connect(depth).connect(warmth.frequency);
  breath.start();

  const nodes = [breath];
  for (const frequency of DRONE) {
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = frequency;
    osc.connect(bed);
    osc.start();
    nodes.push(osc);
  }

  droneNodes = nodes;
}

/** Keeps roughly a second and a half of the pattern queued up, so nothing ever stutters. */
function scheduleAhead() {
  const ac = ctx;
  if (!ac) return;

  while (nextNoteTime < ac.currentTime + LOOKAHEAD_SECONDS) {
    const phrase = PHRASES[Math.floor(step / 8) % PHRASES.length];
    const index = phrase[step % 8];

    if (index != null) {
      const onBeat = step % 2 === 0;
      pluck(ac, nextNoteTime, SCALE[index], onBeat ? 0.26 : 0.17);
      // A quiet fifth above on the strong beats fills the harmony out.
      if (onBeat && index + 4 < SCALE.length && step % 4 === 0) {
        pluck(ac, nextNoteTime + 0.04, SCALE[index + 4], 0.1);
      }
    }

    nextNoteTime += BEAT_SECONDS;
    step += 1;
  }
}

function startSynth() {
  const ac = audioContext();
  if (!ac) return false;

  master = ac.createGain();
  master.gain.setValueAtTime(0.0001, ac.currentTime);
  master.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), ac.currentTime + FADE_SECONDS);
  master.connect(ac.destination);

  startDrone(ac);

  step = 0;
  nextNoteTime = ac.currentTime + 0.25;
  scheduleAhead();
  scheduler = setInterval(scheduleAhead, SCHEDULE_EVERY_MS);
  return true;
}

function stopSynth() {
  clearInterval(scheduler);
  scheduler = null;

  const ac = ctx;
  if (ac && master) {
    // Fade out before tearing anything down, so stopping never clicks.
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), ac.currentTime);
    master.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.5);
    const dying = [...droneNodes];
    const gone = master;
    setTimeout(() => {
      for (const node of dying) {
        try {
          node.stop();
        } catch {
          /* already stopped */
        }
      }
      gone.disconnect();
    }, 700);
  }

  droneNodes = [];
  master = null;
}

// ---- Public interface -----------------------------------------------------

async function start() {
  if (playing || !enabled || !unlocked) return;
  playing = true;

  const file = await tryFile();
  // Disabled while we were loading: do not start behind the user's back.
  if (!enabled) {
    playing = false;
    return;
  }

  if (file) {
    usingFile = true;
    element = file;
    try {
      await file.play();
      fadeElement(file, volume, FADE_SECONDS);
    } catch {
      // Autoplay still refused: fall back to the synth, which rides the same
      // already-unlocked AudioContext.
      element = null;
      usingFile = false;
      playing = startSynth();
    }
    return;
  }

  usingFile = false;
  playing = startSynth();
}

function stop() {
  if (!playing) return;
  playing = false;

  if (usingFile && element) {
    const el = element;
    fadeElement(el, 0, 0.45);
    setTimeout(() => {
      el.pause();
      el.currentTime = 0;
    }, 500);
    element = null;
    return;
  }

  stopSynth();
}

export const music = {
  /** Call from the first user gesture; starts the loop if music is enabled. */
  unlock() {
    if (unlocked) return;
    unlocked = true;
    void start();
  },

  get enabled() {
    return enabled;
  },

  get volume() {
    return volume;
  },

  /** True once a gesture has let us create audio at all. */
  get started() {
    return playing;
  },

  setEnabled(next) {
    enabled = !!next;
    localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
    if (enabled) {
      void start();
    } else {
      stop();
    }
    announce();
    return enabled;
  },

  toggle() {
    return music.setEnabled(!enabled);
  },

  setVolume(next) {
    volume = clamp01(next);
    localStorage.setItem(VOLUME_KEY, String(volume));

    if (usingFile && element) {
      element.volume = volume;
    } else if (ctx && master) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(Math.max(0.0001, volume), ctx.currentTime, 0.08);
    }

    // Nudged the volume up from zero with music off: take that as "play".
    if (volume > 0 && !enabled) {
      music.setEnabled(true);
    } else {
      announce();
    }
    return volume;
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
