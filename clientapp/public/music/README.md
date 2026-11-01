# Background music

`src/music.js` looks for a looping track here, in this order:

1. `tavern.mp3`
2. `tavern.ogg`
3. `tavern.m4a`

The first one that loads is played on a seamless loop under the game. If none of them is
served, the game falls back to a **synthesized** medieval loop (plucked strings over a
slow drone, generated with the Web Audio API) so the table is never silent and the bundle
carries no audio weight at all. The fallback is what ships by default.

## Dropping a real loop in

Any royalty-free medieval / tavern / acoustic loop works — no code change is needed, just
the file.

- Keep it **small**: 1–3 MB, mono or joint stereo, 96–128 kbps is plenty for ambience.
- Make it **loop cleanly** (trim to a musical bar, no silence at either end).
- Aim for something unobtrusive: solo lute, harp or guitar, no percussion spikes and no
  melody strong enough to compete with the dice and build cues in `public/sounds/`.

Good sources for tracks licensed for this kind of use:

- <https://incompetech.com/music/royalty-free/> (CC BY — keep the attribution)
- <https://freepd.com/> (public domain)
- <https://opengameart.org/> (check each track's licence)

If the licence requires attribution, add it to this file and credit it in the repository
README as well.

The widget in the top-right corner of the screen controls the music: on/off, volume, and
the sound-effects mute. All three preferences are kept in `localStorage`.
