/**
 * Tiny audio manager. Plays MP3s from /public/sounds when present and falls back to
 * a short synthesized cue (Web Audio) so the game still has feedback without assets.
 * Browsers block audio until the first user gesture, so `unlock()` is wired to the
 * first click/keydown in App.
 */
const SOURCES = {
  dice: '/sounds/dice.mp3',
  turn: '/sounds/turn.mp3',
  chat: '/sounds/chat.mp3',
  road: '/sounds/road.mp3',
  settlement: '/sounds/settlement.mp3',
  city: '/sounds/city.mp3',
};

// Chime fallbacks, as [frequency, start offset, decay] notes.
const NOTES = {
  turn: [[659.25, 0, 0.5], [987.77, 0.14, 0.5]],
  chat: [[880, 0, 0.18]],
  city: [[523.25, 0, 0.22], [659.25, 0.09, 0.26], [1046.5, 0.19, 0.55]],
};

// Wooden-knock fallbacks: one timber dropped for a road, a brighter three-knock hammering
// for a settlement. Same material, unmistakably different rhythm.
const KNOCKS = {
  road: [{ at: 0, from: 260, to: 90, body: 340, gain: 1 }],
  settlement: [
    { at: 0, from: 430, to: 150, body: 620, gain: 0.85 },
    { at: 0.1, from: 430, to: 150, body: 620, gain: 0.7 },
    { at: 0.2, from: 500, to: 170, body: 700, gain: 1 },
  ],
};

const STORAGE_KEY = 'catan.muted';

let muted = localStorage.getItem(STORAGE_KEY) === '1';
let unlocked = false;
let ctx = null;
const cache = new Map();
const listeners = new Set();

function audioContext() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/**
 * Synthesized fallbacks: dice = burst of short noisy clicks, road and settlement = wooden
 * knocks from KNOCKS, everything else a short chime from NOTES (turn, chat, city).
 */
function synth(name) {
  const ac = audioContext();
  if (!ac) return;
  const now = ac.currentTime;
  const master = ac.createGain();
  master.gain.value = 0.25;
  master.connect(ac.destination);

  if (name === 'dice') {
    for (let i = 0; i < 7; i++) {
      const t = now + i * 0.07 + Math.random() * 0.02;
      const buffer = ac.createBuffer(1, ac.sampleRate * 0.04, ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let j = 0; j < data.length; j++) data[j] = (Math.random() * 2 - 1) * (1 - j / data.length);
      const src = ac.createBufferSource();
      src.buffer = buffer;
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800 + Math.random() * 1200;
      bp.Q.value = 4;
      const g = ac.createGain();
      g.gain.setValueAtTime(1 - i * 0.1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      src.connect(bp).connect(g).connect(master);
      src.start(t);
    }
    return;
  }

  // Wooden placement cues are all knocks, so road / settlement sit in the same family.
  const knocks = KNOCKS[name];
  if (knocks) {
    for (const { at, from, to, body, gain } of knocks) {
      const t = now + at;
      // Timber hitting timber: a short noise burst over a thud that drops in pitch.
      const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.12), ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
      }
      const src = ac.createBufferSource();
      src.buffer = buffer;
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = body;
      bp.Q.value = 2.5;
      const noiseGain = ac.createGain();
      noiseGain.gain.value = gain;
      src.connect(bp).connect(noiseGain).connect(master);
      src.start(t);

      const osc = ac.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(from, t);
      osc.frequency.exponentialRampToValueAtTime(to, t + 0.12);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.7 * gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + 0.2);
    }
    return;
  }

  const notes = NOTES[name] ?? NOTES.chat;
  for (const [freq, offset, decay] of notes) {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = ac.createGain();
    const t = now + offset;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.8, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + decay + 0.1);
  }
}

function element(name) {
  if (!cache.has(name)) {
    const el = new Audio(SOURCES[name]);
    el.preload = 'auto';
    el.volume = 0.6;
    cache.set(name, el);
  }
  return cache.get(name);
}

export const sound = {
  /** Call from the first user gesture so later programmatic plays are allowed. */
  unlock() {
    if (unlocked) return;
    unlocked = true;
    audioContext();
    for (const name of Object.keys(SOURCES)) element(name).load();
  },

  play(name) {
    if (muted || !SOURCES[name]) return;
    const el = element(name);
    try {
      el.currentTime = 0;
      const p = el.play();
      if (p?.catch) p.catch(() => synth(name));
    } catch {
      synth(name);
    }
    // No file served (dev without assets): the element errors asynchronously; use synth.
    el.onerror = () => {
      el.onerror = null;
      synth(name);
    };
  },

  get muted() {
    return muted;
  },

  toggleMuted() {
    muted = !muted;
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
    for (const fn of listeners) fn(muted);
    return muted;
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
