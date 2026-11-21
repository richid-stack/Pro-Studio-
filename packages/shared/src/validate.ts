/**
 * Validates a project read from storage, a file or the network before the app trusts it. Anything that is not
 * a well-formed project is rejected with a reason; recoverable problems (a velocity of 3, a step array that is
 * too short) are repaired, so a slightly damaged save still opens.
 */
import { MAX_BARS, PROJECT_SCHEMA_VERSION, STEPS_PER_BAR, type Channel, type DrumChannel, type InstrumentChannel, type MixSettings, type Note, type Project } from './project';
import { MAX_NOTE, MIN_NOTE, MAX_RATCHET } from './edit';
import { SCALES, clamp, type Genre, type ScaleId } from './theory';

export type ParseResult = { ok: true; project: Project } | { ok: false; error: string };

const GENRES: readonly Genre[] = ['trap', 'drill', 'rnb', 'afro'];
const DRUMS = ['kick', 'snare', 'clap', 'hat', 'ohat', 'rim'] as const;
const INSTS = ['sub', 'rhodes', 'pluck', 'pad', 'organ', 'chop', 'sampler'] as const;
const ROLLS = ['flat', 'up', 'down', 'updown'] as const;

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const num = (x: unknown, fallback: number): number => (typeof x === 'number' && Number.isFinite(x) ? x : fallback);
const str = (x: unknown, fallback: string): string => (typeof x === 'string' ? x : fallback);

function mix(x: unknown): MixSettings {
  const o = isObj(x) ? x : {};
  return {
    db: clamp(num(o.db, -6), -60, 6),
    pan: clamp(num(o.pan, 0), -1, 1),
    rev: clamp(num(o.rev, 0), 0, 1),
    dly: clamp(num(o.dly, 0), 0, 1),
    duck: clamp(num(o.duck, 0), 0, 1),
    mute: o.mute === true,
    solo: o.solo === true,
  };
}

function channel(x: unknown, steps: number, index: number): Channel | null {
  if (!isObj(x)) return null;
  const id = str(x.id, '').slice(0, 64);
  if (!id) return null;
  const base = { id, name: str(x.name, id).slice(0, 40), color: /^ch-(1[0-2]|[1-9])$/.test(str(x.color, '')) ? (x.color as string) : `ch-${(index % 12) + 1}`, mix: mix(x.mix) };
  if (x.type === 'drum') {
    if (!(DRUMS as readonly unknown[]).includes(x.drum)) return null;
    const v = Array.from({ length: steps }, (_, i) => clamp(num(Array.isArray(x.v) ? x.v[i] : 0, 0), 0, 1));
    const r = Array.from({ length: steps }, (_, i) => Math.round(clamp(num(Array.isArray(x.r) ? x.r[i] : 1, 1), 1, MAX_RATCHET)));
    const roll = (ROLLS as readonly unknown[]).includes(x.roll) ? (x.roll as DrumChannel['roll']) : 'flat';
    return { ...base, type: 'drum', drum: x.drum as DrumChannel['drum'], v, r, roll };
  }
  if (x.type === 'inst') {
    if (!(INSTS as readonly unknown[]).includes(x.inst)) return null;
    const seen = new Set<number>();
    const notes: Note[] = [];
    for (const raw of Array.isArray(x.notes) ? x.notes : []) {
      if (!isObj(raw)) continue;
      let id = Math.round(num(raw.id, 0));
      while (id <= 0 || seen.has(id)) id++;
      seen.add(id);
      const t = clamp(num(raw.t, 0), 0, steps - 0.25);
      notes.push({ id, t, d: clamp(num(raw.d, 1), 0.25, steps - t), n: Math.round(clamp(num(raw.n, 60), MIN_NOTE, MAX_NOTE)), v: clamp(num(raw.v, 0.8), 0.05, 1), s: raw.s === true });
    }
    return { ...base, type: 'inst', inst: x.inst as InstrumentChannel['inst'], notes };
  }
  return null;
}

export function parseProject(raw: unknown): ParseResult {
  if (!isObj(raw)) return { ok: false, error: 'Not a project file.' };
  if (raw.version !== PROJECT_SCHEMA_VERSION) return { ok: false, error: `This project is version ${String(raw.version)}; this app reads version ${PROJECT_SCHEMA_VERSION}.` };
  const bars = Math.round(clamp(num(raw.bars, 2), 1, MAX_BARS));
  const steps = bars * STEPS_PER_BAR;
  if (!Array.isArray(raw.channels)) return { ok: false, error: 'The project has no channel list.' };
  if (raw.channels.length > 64) return { ok: false, error: 'Too many channels.' };
  const channels: Channel[] = [];
  const ids = new Set<string>();
  raw.channels.forEach((c, i) => {
    const ch = channel(c, steps, i);
    if (ch && !ids.has(ch.id)) {
      ids.add(ch.id);
      channels.push(ch);
    }
  });
  const p808 = isObj(raw.p808) ? raw.p808 : {};
  const project: Project = {
    version: PROJECT_SCHEMA_VERSION,
    name: str(raw.name, 'Untitled').slice(0, 80),
    bpm: clamp(num(raw.bpm, 120), 40, 240),
    swing: clamp(num(raw.swing, 0), 0, 1),
    human: clamp(num(raw.human, 0), 0, 1),
    genre: (GENRES as readonly unknown[]).includes(raw.genre) ? (raw.genre as Genre) : 'trap',
    key: Math.round(clamp(num(raw.key, 0), 0, 11)),
    scale: str(raw.scale, 'minor') in SCALES ? (raw.scale as ScaleId) : 'minor',
    bars,
    lock: raw.lock === true,
    masterDb: clamp(num(raw.masterDb, -1), -60, 6),
    p808: { decay: clamp(num(p808.decay, 1.3), 0.1, 6), glide: clamp(num(p808.glide, 0.08), 0, 1), drive: clamp(num(p808.drive, 0.35), 0, 1) },
    channels,
  };
  return { ok: true, project };
}

/** Parse JSON text from storage or a file. Never throws. */
export function parseProjectJson(text: string): ParseResult {
  try {
    return parseProject(JSON.parse(text) as unknown);
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' };
  }
}
