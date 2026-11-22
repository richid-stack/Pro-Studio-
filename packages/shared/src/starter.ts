/**
 * Starter projects: one per genre, so the studio never opens empty and a beginner hears a real beat in the
 * first second. They are starting points written from the conventions of each genre (tempo, drum placement,
 * bass movement, chord colour), not finished songs; the user changes everything.
 */
import { PROGRESSIONS, realizeProgression, type Genre } from './theory';
import { PROJECT_SCHEMA_VERSION, STEPS_PER_BAR, type Channel, type DrumChannel, type DrumName, type InstrumentChannel, type InstrumentName, type MixSettings, type Note, type Project } from './project';

const BARS = 2;
const STEPS = BARS * STEPS_PER_BAR;

const mix = (db: number, over: Partial<MixSettings> = {}): MixSettings => ({ db, pan: 0, rev: 0, dly: 0, duck: 0, mute: false, solo: false, ...over });

/** Steps given as `{ stepIndex: velocity }` for one bar are repeated; pass 32 entries via `bar2` for a variation. */
function drum(id: string, name: string, drumName: DrumName, color: number, bar1: Record<number, number>, bar2: Record<number, number> = bar1, m: MixSettings = mix(-6), ratchets: Record<number, number> = {}, roll: DrumChannel['roll'] = 'flat'): DrumChannel {
  const v = new Array<number>(STEPS).fill(0);
  const r = new Array<number>(STEPS).fill(1);
  for (const [s, x] of Object.entries(bar1)) v[Number(s)] = x;
  for (const [s, x] of Object.entries(bar2)) v[STEPS_PER_BAR + Number(s)] = x;
  for (const [s, x] of Object.entries(ratchets)) r[Number(s)] = x;
  return { id, name, color: `ch-${color}`, mix: m, type: 'drum', drum: drumName, v, r, roll };
}

type NoteSpec = [t: number, d: number, n: number, v?: number, slide?: boolean];
function inst(id: string, name: string, kind: InstrumentName, color: number, notes: NoteSpec[], m: MixSettings): InstrumentChannel {
  const ns: Note[] = notes.map(([t, d, n, v = 0.85, s = false], i) => ({ id: i + 1, t, d, n, v, s }));
  return { id, name, color: `ch-${color}`, mix: m, type: 'inst', inst: kind, notes: ns };
}

function chordNotes(genre: Genre, keyPc: number, progressionIndex = 0, velocity = 0.7): NoteSpec[] {
  const prog = (PROGRESSIONS[genre][progressionIndex] ?? PROGRESSIONS[genre][0]) as (typeof PROGRESSIONS)[Genre][number];
  const out: NoteSpec[] = [];
  for (const c of realizeProgression(prog, keyPc, 48)) {
    if (c.startBar >= BARS) continue;
    for (const n of c.notes) out.push([c.startBar * STEPS_PER_BAR, Math.min(c.bars, BARS - c.startBar) * STEPS_PER_BAR - 1, n + 12, velocity]);
  }
  return out;
}

const every = (from: number, to: number, by: number, v: number): Record<number, number> => {
  const o: Record<number, number> = {};
  for (let s = from; s < to; s += by) o[s] = v;
  return o;
};

interface Recipe {
  name: string;
  bpm: number;
  swing: number;
  key: number;
  channels: (keyPc: number) => Channel[];
}

const RECIPES: Record<Genre, Recipe> = {
  trap: {
    name: 'Trap starter',
    bpm: 140,
    swing: 0,
    key: 0,
    channels: (k) => [
      drum('kick', 'Kick', 'kick', 1, { 0: 1, 7: 0.75, 10: 0.9 }, { 0: 1, 6: 0.7, 10: 0.9, 13: 0.8 }, mix(-3, { pan: 0 })),
      drum('snare', 'Snare', 'snare', 2, { 8: 1 }, { 8: 1 }, mix(-6)),
      drum('clap', 'Clap', 'clap', 3, { 8: 0.7 }, { 8: 0.7 }, mix(-9, { rev: 0.18 })),
      drum('hat', 'Hat', 'hat', 4, { ...every(0, 16, 2, 0.75), ...every(1, 16, 2, 0.4) }, { ...every(0, 16, 2, 0.75), ...every(1, 16, 2, 0.4) }, mix(-12, { pan: 0.15 }), { 14: 3, 30: 4 }, 'up'),
      drum('ohat', 'Open hat', 'ohat', 5, { 6: 0.6 }, { 6: 0.6, 14: 0.55 }, mix(-14, { pan: -0.15 })),
      inst('bass', '808', 'sub', 6, [[0, 6, 36 + k], [7, 3, 36 + k + 3, 0.9, true], [10, 6, 36 + k + 5], [16, 7, 36 + k + 8, 1], [23, 3, 36 + k + 7, 0.85, true], [26, 6, 36 + k + 3]], mix(-4)),
      inst('keys', 'Keys', 'rhodes', 7, chordNotes('trap', k), mix(-11, { rev: 0.25, duck: 0.35 })),
    ],
  },
  drill: {
    name: 'Drill starter',
    bpm: 142,
    swing: 0,
    key: 1,
    channels: (k) => [
      drum('kick', 'Kick', 'kick', 1, { 0: 1, 10: 0.9 }, { 0: 1, 3: 0.6, 11: 0.9 }, mix(-3)),
      drum('snare', 'Snare', 'snare', 2, { 8: 1 }, { 8: 1, 15: 0.45 }, mix(-6)),
      drum('hat', 'Hat', 'hat', 4, { ...every(0, 16, 2, 0.7), ...every(1, 16, 2, 0.35) }, { ...every(0, 16, 2, 0.7), ...every(1, 16, 2, 0.35) }, mix(-12, { pan: 0.2 }), { 5: 3, 11: 3, 14: 3, 29: 3 }, 'down'),
      drum('rim', 'Rim', 'rim', 8, {}, { 12: 0.5 }, mix(-12)),
      inst('bass', '808', 'sub', 6, [[0, 5, 36 + k], [6, 4, 36 + k + 1, 0.9, true], [10, 6, 36 + k], [16, 6, 36 + k + 3], [22, 4, 36 + k + 1, 0.9, true], [26, 5, 36 + k]], mix(-4)),
      inst('strings', 'Pluck', 'pluck', 9, chordNotes('drill', k, 0, 0.6), mix(-12, { rev: 0.3, dly: 0.12 })),
    ],
  },
  rnb: {
    name: 'R&B starter',
    bpm: 72,
    swing: 0.25,
    key: 3,
    channels: (k) => [
      drum('kick', 'Kick', 'kick', 1, { 0: 1, 7: 0.7, 10: 0.85 }, { 0: 1, 9: 0.75 }, mix(-4)),
      drum('snare', 'Snare', 'snare', 2, { 8: 0.9 }, { 8: 0.9 }, mix(-8, { rev: 0.2 })),
      drum('hat', 'Hat', 'hat', 4, every(0, 16, 2, 0.55), every(0, 16, 2, 0.55), mix(-14, { pan: 0.2 })),
      drum('rim', 'Rim', 'rim', 8, { 4: 0.4, 12: 0.4 }, { 4: 0.4, 12: 0.4 }, mix(-14, { pan: -0.2 })),
      inst('bass', '808', 'sub', 6, [[0, 7, 36 + k], [10, 5, 36 + k + 5], [16, 7, 36 + k + 7], [26, 5, 36 + k + 2]], mix(-5)),
      inst('keys', 'Keys', 'rhodes', 7, chordNotes('rnb', k, 0, 0.65), mix(-10, { rev: 0.3, duck: 0.2 })),
      inst('pad', 'Pad', 'pad', 10, chordNotes('rnb', k, 1, 0.5).map(([t, d, n, v]) => [t, d, n - 12, v] as NoteSpec), mix(-16, { rev: 0.35 })),
    ],
  },
  afro: {
    name: 'Afrobeat starter',
    bpm: 102,
    swing: 0.12,
    key: 0,
    channels: (k) => [
      drum('kick', 'Kick', 'kick', 1, { 0: 1, 6: 0.8, 10: 0.7 }, { 0: 1, 6: 0.8, 11: 0.7 }, mix(-4)),
      drum('snare', 'Snare', 'snare', 2, { 8: 0.8 }, { 8: 0.8, 14: 0.4 }, mix(-8)),
      drum('rim', 'Rim', 'rim', 8, { 0: 0.55, 3: 0.65, 6: 0.55, 10: 0.65, 12: 0.55 }, { 0: 0.55, 3: 0.65, 6: 0.55, 10: 0.65, 12: 0.55 }, mix(-11, { pan: -0.2 })),
      drum('hat', 'Shaker', 'hat', 4, every(0, 16, 1, 0.45), every(0, 16, 1, 0.45), mix(-15, { pan: 0.25 })),
      drum('ohat', 'Open hat', 'ohat', 5, { 14: 0.5 }, { 14: 0.5 }, mix(-16)),
      inst('bass', 'Log bass', 'sub', 6, [[0, 2, 36 + k + 7], [3, 2, 36 + k + 7], [6, 3, 36 + k + 5], [10, 2, 36 + k + 3], [16, 2, 36 + k + 7], [19, 2, 36 + k + 7], [22, 3, 36 + k + 5], [27, 3, 36 + k + 2]], mix(-5)),
      inst('keys', 'Keys', 'pluck', 9, chordNotes('afro', k, 0, 0.65), mix(-12, { rev: 0.2, dly: 0.15 })),
    ],
  },
};

export function createStarterProject(genre: Genre = 'trap'): Project {
  const r = RECIPES[genre];
  const prog = PROGRESSIONS[genre][0];
  return {
    version: PROJECT_SCHEMA_VERSION,
    name: r.name,
    bpm: r.bpm,
    swing: r.swing,
    human: 0.1,
    genre,
    key: r.key,
    scale: prog?.scale ?? 'minor',
    bars: BARS,
    lock: false,
    masterDb: -1,
    p808: { decay: 1.3, glide: 0.08, drive: 0.35 },
    channels: r.channels(r.key),
  };
}

/** An empty project: just tempo and key, for "new project". */
export function createBlankProject(genre: Genre = 'trap'): Project {
  const base = createStarterProject(genre);
  return { ...base, name: 'Untitled', channels: [] };
}

