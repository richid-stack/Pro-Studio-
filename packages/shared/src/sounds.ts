/**
 * The sounds the browser panel offers. Only sounds the engine can really make are listed here: the sampler and
 * chop channels need audio files, and loading files is on the roadmap, so they are not offered yet.
 */
import type { DrumName, InstrumentName } from './project';

export type SoundEntry =
  | { id: string; kind: 'drum'; drum: DrumName; label: string; hint: string; tags: readonly string[] }
  | { id: string; kind: 'inst'; inst: InstrumentName; label: string; hint: string; tags: readonly string[]; auditionNote: number; auditionSeconds: number };

export const SOUND_LIBRARY: readonly SoundEntry[] = [
  { id: 'drum:kick', kind: 'drum', drum: 'kick', label: 'Kick', hint: 'Round, with a short click', tags: ['drums', 'low', 'punch'] },
  { id: 'drum:snare', kind: 'drum', drum: 'snare', label: 'Snare', hint: 'Three round-robin variations', tags: ['drums', 'backbeat', 'snap'] },
  { id: 'drum:clap', kind: 'drum', drum: 'clap', label: 'Clap', hint: 'Layered bursts with a tail', tags: ['drums', 'backbeat', 'layered'] },
  { id: 'drum:hat', kind: 'drum', drum: 'hat', label: 'Closed hat', hint: 'Tight, shuts the open hat', tags: ['drums', 'hats', 'bright'] },
  { id: 'drum:ohat', kind: 'drum', drum: 'ohat', label: 'Open hat', hint: 'Long shimmer', tags: ['drums', 'hats', 'bright'] },
  { id: 'drum:rim', kind: 'drum', drum: 'rim', label: 'Rim', hint: 'Wooden click', tags: ['drums', 'percussion', 'dry'] },
  { id: 'inst:sub', kind: 'inst', inst: 'sub', label: '808 sub', hint: 'Sliding sub bass', tags: ['instrument', 'bass', 'low'], auditionNote: 36, auditionSeconds: 0.9 },
  { id: 'inst:rhodes', kind: 'inst', inst: 'rhodes', label: 'Keys', hint: 'Soft electric piano', tags: ['instrument', 'keys', 'warm'], auditionNote: 60, auditionSeconds: 0.5 },
  { id: 'inst:pluck', kind: 'inst', inst: 'pluck', label: 'Pluck', hint: 'Short and bright', tags: ['instrument', 'melody', 'bright'], auditionNote: 67, auditionSeconds: 0.25 },
  { id: 'inst:pad', kind: 'inst', inst: 'pad', label: 'Pad', hint: 'Slow, wide chords', tags: ['instrument', 'chords', 'warm'], auditionNote: 60, auditionSeconds: 1.2 },
  { id: 'inst:organ', kind: 'inst', inst: 'organ', label: 'Organ', hint: 'Steady drawbar tone', tags: ['instrument', 'keys', 'chords'], auditionNote: 60, auditionSeconds: 0.6 },
];

/** True when every word of the query appears in the text (case-insensitive). An empty query matches everything. */
export function matchesQuery(text: string, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = text.toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** The text a sound is searched by: its name, its one-line description and its tags. */
export function soundSearchText(s: SoundEntry): string {
  return `${s.label} ${s.hint} ${s.tags.join(' ')} ${s.kind === 'drum' ? 'drum' : 'instrument'}`;
}

/** Entries that match every word of the query. An empty query matches all. */
export function searchSounds(query: string, list: readonly SoundEntry[] = SOUND_LIBRARY): SoundEntry[] {
  return list.filter((s) => matchesQuery(soundSearchText(s), query));
}
