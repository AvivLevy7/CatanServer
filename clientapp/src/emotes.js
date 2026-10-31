/**
 * Quick-emote vocabulary. The `id` values must match `Emotes.Allowed` on the C# side -
 * the hub rejects anything else, so adding one here means adding it there too.
 *
 * `line` is the comic-book text that appears in the speech bubble; `glyph` is what the
 * wheel button and the bubble show. Order is the order they bloom out of the launcher.
 */
export const EMOTES = [
  { id: 'BeggingSheep', glyph: '\u{1F411}', label: 'Begging for sheep', line: 'Sheep? Anyone?' },
  { id: 'AngryRobber', glyph: '\u{1F620}', label: 'Angry at the robber', line: 'That robber again!' },
  { id: 'Thanks', glyph: '\u{1F91D}', label: 'Thanks for the trade', line: 'Pleasure doing business!' },
  { id: 'HurryUp', glyph: '\u{23F3}', label: 'Hurry up', line: 'Any day now...' },
  { id: 'ThumbsUp', glyph: '\u{1F44D}', label: 'Nice one', line: 'Nice one!' },
  { id: 'Taunt', glyph: '\u{1F60F}', label: 'Taunt', line: 'Too easy.' },
];

const BY_ID = new Map(EMOTES.map((e) => [e.id, e]));

/** Falls back to a neutral bubble so an unknown id from the wire never blanks the UI. */
export const emoteById = (id) => BY_ID.get(id) ?? { id, glyph: '❓', label: id, line: '...' };
