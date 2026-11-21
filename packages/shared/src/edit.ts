/**
 * Pure edits to a Project. Every function returns a new Project and never mutates its input, so the UI can
 * hold history as a list of snapshots and React can compare by reference. All of them clamp bad input
 * (a velocity of 5, a note below 0) instead of throwing, because the caller is usually a pointer drag.
 */
import { MAX_BARS, STEPS_PER_BAR, type Channel, type DrumChannel, type DrumName, type InstrumentChannel, type InstrumentName, type MixSettings, type Note, type Project } from './project';
import { clamp } from './theory';

export const MIN_BPM = 40;
export const MAX_BPM = 240;
export const MIN_NOTE = 12;
export const MAX_NOTE = 108;
/** Longest ratchet on one step. */
export const MAX_RATCHET = 8;

export function findChannel(p: Project, id: string): Channel | undefined {
  return p.channels.find((c) => c.id === id);
}

function mapChannel(p: Project, id: string, f: (c: Channel) => Channel): Project {
  let changed = false;
  const channels = p.channels.map((c) => {
    if (c.id !== id) return c;
    const next = f(c);
    if (next !== c) changed = true;
    return next;
  });
  // an edit that changes nothing returns the same project, so history and React can skip it
  return changed ? { ...p, channels } : p;
}

const mapDrum = (p: Project, id: string, f: (c: DrumChannel) => DrumChannel): Project => mapChannel(p, id, (c) => (c.type === 'drum' ? f(c) : c));
const mapInst = (p: Project, id: string, f: (c: InstrumentChannel) => InstrumentChannel): Project => mapChannel(p, id, (c) => (c.type === 'inst' ? f(c) : c));

export const totalSteps = (p: Project): number => p.bars * STEPS_PER_BAR;

/* ------------------------------------------------------------- project */

export function setBpm(p: Project, bpm: number): Project {
  return { ...p, bpm: Math.round(clamp(bpm, MIN_BPM, MAX_BPM) * 100) / 100 };
}

export function setSwing(p: Project, swing: number): Project {
  return { ...p, swing: clamp(swing, 0, 1) };
}

export function setMasterDb(p: Project, db: number): Project {
  return { ...p, masterDb: clamp(db, -60, 6) };
}

/** Change the pattern length. Growing repeats what is already there; shrinking drops notes that no longer fit. */
export function setBars(p: Project, bars: number): Project {
  const next = Math.round(clamp(bars, 1, MAX_BARS));
  if (next === p.bars) return p;
  const oldSteps = p.bars * STEPS_PER_BAR;
  const newSteps = next * STEPS_PER_BAR;
  const tile = <T>(arr: T[], fill: T): T[] => Array.from({ length: newSteps }, (_, i) => (i < oldSteps ? (arr[i] ?? fill) : (arr[i % oldSteps] ?? fill)));
  const channels = p.channels.map((c): Channel => {
    if (c.type === 'drum') return { ...c, v: tile(c.v, 0), r: tile(c.r, 1) };
    if (next > p.bars) {
      // each new bar repeats the bar `bar % oldBars` places before it, so a 1-bar loop tiles and a 2-bar loop alternates
      const copies: Note[] = [];
      let id = Math.max(0, ...c.notes.map((n) => n.id));
      for (let bar = p.bars; bar < next; bar++) {
        const src = bar % p.bars;
        for (const n of c.notes) {
          if (n.t < src * STEPS_PER_BAR || n.t >= (src + 1) * STEPS_PER_BAR) continue;
          const t = n.t - src * STEPS_PER_BAR + bar * STEPS_PER_BAR;
          copies.push({ ...n, id: ++id, t, d: Math.min(n.d, newSteps - t) });
        }
      }
      return { ...c, notes: [...c.notes, ...copies] };
    }
    return { ...c, notes: c.notes.filter((n) => n.t < newSteps).map((n) => (n.t + n.d > newSteps ? { ...n, d: newSteps - n.t } : n)) };
  });
  return { ...p, bars: next, channels };
}

/* ---------------------------------------------------------------- mixer */

export function setMix(p: Project, channelId: string, patch: Partial<MixSettings>): Project {
  return mapChannel(p, channelId, (c) => {
    const m = { ...c.mix, ...patch };
    m.db = clamp(m.db, -60, 6);
    m.pan = clamp(m.pan, -1, 1);
    m.rev = clamp(m.rev, 0, 1);
    m.dly = clamp(m.dly, 0, 1);
    m.duck = clamp(m.duck, 0, 1);
    return { ...c, mix: m };
  });
}

export function renameChannel(p: Project, channelId: string, name: string): Project {
  const trimmed = name.trim().slice(0, 40);
  return trimmed ? mapChannel(p, channelId, (c) => ({ ...c, name: trimmed })) : p;
}

/* ------------------------------------------------------------ step grid */

/** Turn a step on (at `velocity`) or off. Out-of-range steps are ignored. */
export function toggleStep(p: Project, channelId: string, step: number, velocity = 0.8): Project {
  if (step < 0 || step >= totalSteps(p)) return p;
  return mapDrum(p, channelId, (c) => {
    const v = c.v.slice();
    v[step] = (v[step] ?? 0) > 0 ? 0 : clamp(velocity, 0.05, 1);
    const r = c.r.slice();
    if (v[step] === 0) r[step] = 1;
    return { ...c, v, r };
  });
}

export function setStepVelocity(p: Project, channelId: string, step: number, velocity: number): Project {
  if (step < 0 || step >= totalSteps(p)) return p;
  return mapDrum(p, channelId, (c) => {
    const v = c.v.slice();
    v[step] = velocity <= 0 ? 0 : clamp(velocity, 0.05, 1);
    return { ...c, v };
  });
}

/** Ratchet: play the step as `count` evenly spaced hits (1 = a normal hit). A ratchet on an empty step turns it on. */
export function setRatchet(p: Project, channelId: string, step: number, count: number): Project {
  if (step < 0 || step >= totalSteps(p)) return p;
  return mapDrum(p, channelId, (c) => {
    const r = c.r.slice();
    const v = c.v.slice();
    r[step] = Math.round(clamp(count, 1, MAX_RATCHET));
    if ((v[step] ?? 0) === 0) v[step] = 0.8;
    return { ...c, r, v };
  });
}

export function setRollShape(p: Project, channelId: string, roll: DrumChannel['roll']): Project {
  return mapDrum(p, channelId, (c) => ({ ...c, roll }));
}

export function clearChannel(p: Project, channelId: string): Project {
  return mapChannel(p, channelId, (c) => (c.type === 'drum' ? { ...c, v: c.v.map(() => 0), r: c.r.map(() => 1) } : { ...c, notes: [] }));
}

/* ----------------------------------------------------------- piano roll */

const nextId = (notes: readonly Note[]): number => notes.reduce((m, n) => Math.max(m, n.id), 0) + 1;

const clampNote = (n: Note, steps: number): Note => {
  const t = clamp(n.t, 0, Math.max(0, steps - 0.25));
  return { ...n, t, d: clamp(n.d, 0.25, Math.max(0.25, steps - t)), n: Math.round(clamp(n.n, MIN_NOTE, MAX_NOTE)), v: clamp(n.v, 0.05, 1) };
};

/** Add a note. Returns the project and the new note's id, or id -1 if the channel is not an instrument. */
export function addNote(p: Project, channelId: string, note: Omit<Note, 'id'>): { project: Project; id: number } {
  let id = -1;
  const project = mapInst(p, channelId, (c) => {
    id = nextId(c.notes);
    return { ...c, notes: [...c.notes, clampNote({ ...note, id }, totalSteps(p))] };
  });
  return { project, id };
}

/** Add several notes at once (a chord or a pasted selection). Returns the new ids. */
export function addNotes(p: Project, channelId: string, notes: ReadonlyArray<Omit<Note, 'id'>>): { project: Project; ids: number[] } {
  const ids: number[] = [];
  const project = mapInst(p, channelId, (c) => {
    let id = nextId(c.notes);
    const added = notes.map((n) => {
      ids.push(id);
      return clampNote({ ...n, id: id++ }, totalSteps(p));
    });
    return { ...c, notes: [...c.notes, ...added] };
  });
  return { project, ids };
}

export function moveNotes(p: Project, channelId: string, ids: ReadonlySet<number>, dStep: number, dPitch: number): Project {
  const steps = totalSteps(p);
  return mapInst(p, channelId, (c) => {
    const sel = c.notes.filter((n) => ids.has(n.id));
    if (sel.length === 0) return c;
    // clamp the whole group together so a chord keeps its shape at the edges
    const minT = Math.min(...sel.map((n) => n.t));
    const maxEnd = Math.max(...sel.map((n) => n.t + n.d));
    const minN = Math.min(...sel.map((n) => n.n));
    const maxN = Math.max(...sel.map((n) => n.n));
    const dt = clamp(dStep, -minT, steps - maxEnd);
    const dn = Math.round(clamp(dPitch, MIN_NOTE - minN, MAX_NOTE - maxN));
    return { ...c, notes: c.notes.map((n) => (ids.has(n.id) ? { ...n, t: n.t + dt, n: n.n + dn } : n)) };
  });
}

/** Change note lengths by `dSteps` (negative shortens). Never shorter than a 64th, never past the pattern end. */
export function resizeNotes(p: Project, channelId: string, ids: ReadonlySet<number>, dSteps: number): Project {
  const steps = totalSteps(p);
  return mapInst(p, channelId, (c) => ({ ...c, notes: c.notes.map((n) => (ids.has(n.id) ? { ...n, d: clamp(n.d + dSteps, 0.25, steps - n.t) } : n)) }));
}

export function setNoteLength(p: Project, channelId: string, ids: ReadonlySet<number>, length: number): Project {
  const steps = totalSteps(p);
  return mapInst(p, channelId, (c) => ({ ...c, notes: c.notes.map((n) => (ids.has(n.id) ? { ...n, d: clamp(length, 0.25, steps - n.t) } : n)) }));
}

export function setNoteVelocity(p: Project, channelId: string, ids: ReadonlySet<number>, velocity: number): Project {
  return mapInst(p, channelId, (c) => ({ ...c, notes: c.notes.map((n) => (ids.has(n.id) ? { ...n, v: clamp(velocity, 0.05, 1) } : n)) }));
}

export function setNoteSlide(p: Project, channelId: string, ids: ReadonlySet<number>, slide: boolean): Project {
  return mapInst(p, channelId, (c) => ({ ...c, notes: c.notes.map((n) => (ids.has(n.id) ? { ...n, s: slide } : n)) }));
}

export function deleteNotes(p: Project, channelId: string, ids: ReadonlySet<number>): Project {
  return mapInst(p, channelId, (c) => {
    const notes = c.notes.filter((n) => !ids.has(n.id));
    return notes.length === c.notes.length ? c : { ...c, notes };
  });
}

/** Snap note starts to a grid in steps (1 = 16th, 0.5 = 32nd, 4 = quarter). `strength` 0..1 moves part of the way. */
export function quantizeNotes(p: Project, channelId: string, ids: ReadonlySet<number>, grid: number, strength = 1): Project {
  const g = Math.max(0.25, grid);
  return mapInst(p, channelId, (c) => ({
    ...c,
    notes: c.notes.map((n) => {
      if (!ids.has(n.id)) return n;
      const target = Math.round(n.t / g) * g;
      return { ...n, t: Math.max(0, n.t + (target - n.t) * clamp(strength, 0, 1)) };
    }),
  }));
}

/** Copies of the given notes, shifted by `dStep`, for duplicate and paste. Returns the new ids. */
export function duplicateNotes(p: Project, channelId: string, ids: ReadonlySet<number>, dStep: number): { project: Project; ids: number[] } {
  const c = findChannel(p, channelId);
  if (!c || c.type !== 'inst') return { project: p, ids: [] };
  const src = c.notes.filter((n) => ids.has(n.id) && n.t + dStep >= 0 && n.t + dStep < totalSteps(p));
  return addNotes(p, channelId, src.map(({ id: _id, ...n }) => ({ ...n, t: n.t + dStep })));
}

/* -------------------------------------------------------------- channels */

const COLORS = 12;

function freshId(p: Project, base: string): string {
  const taken = new Set(p.channels.map((c) => c.id));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

const DRUM_LABEL: Record<DrumName, string> = { kick: 'Kick', snare: 'Snare', clap: 'Clap', hat: 'Hat', ohat: 'Open hat', rim: 'Rim' };
const INST_LABEL: Record<InstrumentName, string> = { sub: '808', rhodes: 'Keys', pluck: 'Pluck', pad: 'Pad', organ: 'Organ', chop: 'Chops', sampler: 'Sampler' };
const DEFAULT_DB: Record<string, number> = { kick: -3, snare: -5, clap: -7, hat: -11, ohat: -12, rim: -9, sub: -4, rhodes: -10, pluck: -10, pad: -14, organ: -12, chop: -8, sampler: -8 };

export const drumLabel = (d: DrumName): string => DRUM_LABEL[d];
export const instrumentLabel = (i: InstrumentName): string => INST_LABEL[i];

const baseMix = (key: string): MixSettings => ({ db: DEFAULT_DB[key] ?? -8, pan: 0, rev: 0, dly: 0, duck: 0, mute: false, solo: false });

export function addDrumChannel(p: Project, drum: DrumName): { project: Project; id: string } {
  const id = freshId(p, drum);
  const steps = totalSteps(p);
  const ch: DrumChannel = {
    id,
    name: DRUM_LABEL[drum],
    color: `ch-${(p.channels.length % COLORS) + 1}`,
    mix: baseMix(drum),
    type: 'drum',
    drum,
    v: new Array<number>(steps).fill(0),
    r: new Array<number>(steps).fill(1),
    roll: 'flat',
  };
  return { project: { ...p, channels: [...p.channels, ch] }, id };
}

export function addInstrumentChannel(p: Project, inst: InstrumentName): { project: Project; id: string } {
  const id = freshId(p, inst);
  const ch: InstrumentChannel = {
    id,
    name: INST_LABEL[inst],
    color: `ch-${(p.channels.length % COLORS) + 1}`,
    mix: { ...baseMix(inst), duck: inst === 'sub' ? 0 : inst === 'pad' || inst === 'rhodes' ? 0.4 : 0 },
    type: 'inst',
    inst,
    notes: [],
  };
  return { project: { ...p, channels: [...p.channels, ch] }, id };
}

export function removeChannel(p: Project, channelId: string): Project {
  return p.channels.some((c) => c.id === channelId) ? { ...p, channels: p.channels.filter((c) => c.id !== channelId) } : p;
}

export function moveChannel(p: Project, channelId: string, toIndex: number): Project {
  const from = p.channels.findIndex((c) => c.id === channelId);
  if (from < 0) return p;
  const to = Math.round(clamp(toIndex, 0, p.channels.length - 1));
  if (to === from) return p;
  const channels = p.channels.slice();
  const [moved] = channels.splice(from, 1);
  channels.splice(to, 0, moved as Channel);
  return { ...p, channels };
}
