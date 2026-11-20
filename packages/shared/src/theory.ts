/**
 * Music theory primitives shared by the engine, the UI and the assist tools.
 * Pure functions only: no DOM, no audio, no randomness. Everything here is unit-tested.
 */

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
export const mtof = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);
export const ftom = (hz: number): number => 69 + 12 * Math.log2(hz / 440);
export const dbToGain = (db: number): number => (db <= -60 ? 0 : 10 ** (db / 20));
export const gainToDb = (g: number): number => (g <= 0.001 ? -60 : 20 * Math.log10(g));
/** Positive modulo, so negative pitch classes wrap correctly. */
export const mod = (n: number, m: number): number => ((n % m) + m) % m;

/* ------------------------------------------------------------------ names */

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
export const NOTE_NAMES = SHARP_NAMES;

export function pitchClassName(pc: number, flats = false): string {
  const names = flats ? FLAT_NAMES : SHARP_NAMES;
  return names[mod(Math.round(pc), 12)] ?? 'C';
}

/** Scientific pitch notation with C4 = MIDI 60. */
export function midiName(midi: number, flats = false): string {
  return `${pitchClassName(midi, flats)}${Math.floor(midi / 12) - 1}`;
}

/* ----------------------------------------------------------------- scales */

export const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
  minorPentatonic: [0, 3, 5, 7, 10],
  majorPentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
} as const satisfies Record<string, readonly number[]>;

export type ScaleId = keyof typeof SCALES;

export const SCALE_LABELS: Record<ScaleId, string> = {
  minor: 'Minor',
  major: 'Major',
  dorian: 'Dorian',
  phrygian: 'Phrygian',
  lydian: 'Lydian',
  mixolydian: 'Mixolydian',
  locrian: 'Locrian',
  harmonicMinor: 'Harmonic minor',
  melodicMinor: 'Melodic minor',
  phrygianDominant: 'Phrygian dominant',
  minorPentatonic: 'Minor pentatonic',
  majorPentatonic: 'Major pentatonic',
  blues: 'Blues',
};

const intervalsOf = (scale: ScaleId): readonly number[] => SCALES[scale];

export function isInScale(midi: number, keyPc: number, scale: ScaleId): boolean {
  return intervalsOf(scale).includes(mod(midi - keyPc, 12));
}

/** 0-based degree of the note in the scale, or null when it is outside it. */
export function scaleDegreeOf(midi: number, keyPc: number, scale: ScaleId): number | null {
  const i = intervalsOf(scale).indexOf(mod(midi - keyPc, 12));
  return i < 0 ? null : i;
}

/** Nearest in-scale note; when two are equally close the lower one wins. */
export function snapToScale(midi: number, keyPc: number, scale: ScaleId): number {
  for (let d = 0; d <= 6; d++) {
    if (isInScale(midi - d, keyPc, scale)) return midi - d;
    if (isInScale(midi + d, keyPc, scale)) return midi + d;
  }
  return midi;
}

/** Whether to spell the key with flats (F, Bb, Eb, Ab, Db, Gb majors and their relative minors). */
export function prefersFlats(keyPc: number, scale: ScaleId): boolean {
  const third = intervalsOf(scale)[2];
  const minorFamily = third === 3;
  const relativeMajor = minorFamily ? mod(keyPc + 3, 12) : keyPc;
  return [5, 10, 3, 8, 1, 6].includes(relativeMajor);
}

/* ----------------------------------------------------------------- chords */

export const CHORD_TYPES = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  six: [0, 4, 7, 9],
  min6: [0, 3, 7, 9],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  minMaj7: [0, 3, 7, 11],
  add9: [0, 4, 7, 14],
  maj9: [0, 4, 7, 11, 14],
  min9: [0, 3, 7, 10, 14],
  dom9: [0, 4, 7, 10, 14],
  min11: [0, 3, 7, 10, 14, 17],
} as const satisfies Record<string, readonly number[]>;

export type ChordType = keyof typeof CHORD_TYPES;

export const CHORD_SYMBOLS: Record<ChordType, string> = {
  maj: '',
  min: 'm',
  dim: 'dim',
  aug: 'aug',
  sus2: 'sus2',
  sus4: 'sus4',
  six: '6',
  min6: 'm6',
  maj7: 'maj7',
  min7: 'm7',
  dom7: '7',
  m7b5: 'm7b5',
  dim7: 'dim7',
  minMaj7: 'm(maj7)',
  add9: 'add9',
  maj9: 'maj9',
  min9: 'm9',
  dom9: '9',
  min11: 'm11',
};

/** Notes of a chord, lowest first. Inversion n moves the n lowest notes up an octave. */
export function buildChord(rootMidi: number, type: ChordType, inversion = 0): number[] {
  const notes = CHORD_TYPES[type].map((i) => rootMidi + i);
  for (let k = 0; k < Math.min(inversion, notes.length - 1); k++) {
    const lowest = notes.shift();
    if (lowest !== undefined) notes.push(lowest + 12);
  }
  return notes;
}

export interface DetectedChord {
  rootPc: number;
  type: ChordType;
  bassPc: number;
  symbol: string;
}

const CHORD_PC_SETS = (Object.keys(CHORD_TYPES) as ChordType[]).map((type) => ({
  type,
  pcs: new Set(CHORD_TYPES[type].map((i) => i % 12)),
}));

/** Name the chord formed by a set of MIDI notes (any order, any octaves). Null when nothing matches. */
export function detectChord(midiNotes: readonly number[], flats = false): DetectedChord | null {
  if (midiNotes.length < 3) return null;
  const bass = Math.min(...midiNotes);
  const bassPc = mod(bass, 12);
  const present = new Set(midiNotes.map((n) => mod(n, 12)));
  const roots = [bassPc, ...[...present].filter((p) => p !== bassPc)];
  for (const rootPc of roots) {
    const rel = new Set([...present].map((p) => mod(p - rootPc, 12)));
    for (const c of CHORD_PC_SETS) {
      if (c.pcs.size === rel.size && [...c.pcs].every((p) => rel.has(p))) {
        const sym = `${pitchClassName(rootPc, flats)}${CHORD_SYMBOLS[c.type]}`;
        return { rootPc, type: c.type, bassPc, symbol: rootPc === bassPc ? sym : `${sym}/${pitchClassName(bassPc, flats)}` };
      }
    }
  }
  return null;
}

export type ChordExtension = 'triad' | 'seventh' | 'ninth';

/**
 * Stack thirds on a scale degree, staying inside the key. Works for the seven-note scales;
 * returns null for pentatonic and blues, where stacked thirds are not meaningful.
 * `tonicMidi` is the MIDI note of the key's tonic in the octave the chord should start from.
 */
export function diatonicChord(
  tonicMidi: number,
  scale: ScaleId,
  degree: number,
  extension: ChordExtension = 'triad',
): number[] | null {
  const iv = intervalsOf(scale);
  if (iv.length !== 7) return null;
  const count = extension === 'triad' ? 3 : extension === 'seventh' ? 4 : 5;
  const out: number[] = [];
  for (let k = 0; k < count; k++) {
    const idx = degree + k * 2;
    out.push(tonicMidi + (iv[idx % 7] ?? 0) + 12 * Math.floor(idx / 7));
  }
  return out;
}

/* ------------------------------------------------------------ progressions */

export type Genre = 'trap' | 'drill' | 'rnb' | 'afro';

export interface ProgressionStep {
  /** 0-based scale degree: 0 = I / i, 5 = VI / vi. */
  degree: number;
  extension: ChordExtension;
}

export interface Progression {
  id: string;
  label: string;
  scale: ScaleId;
  steps: readonly ProgressionStep[];
  barsPerChord: number;
}

const steps = (degrees: number[], extension: ChordExtension): ProgressionStep[] =>
  degrees.map((degree) => ({ degree, extension }));

export const PROGRESSIONS: Record<Genre, readonly Progression[]> = {
  trap: [
    { id: 'trap-i-VI-III-VII', label: 'i – VI – III – VII', scale: 'minor', steps: steps([0, 5, 2, 6], 'triad'), barsPerChord: 1 },
    { id: 'trap-andalusian', label: 'i – VII – VI – V', scale: 'harmonicMinor', steps: steps([0, 6, 5, 4], 'triad'), barsPerChord: 1 },
    { id: 'trap-i-iv-VII-III', label: 'i – iv – VII – III', scale: 'minor', steps: steps([0, 3, 6, 2], 'seventh'), barsPerChord: 1 },
  ],
  drill: [
    { id: 'drill-phrygian', label: 'i – bII (Phrygian)', scale: 'phrygian', steps: steps([0, 1, 0, 1], 'triad'), barsPerChord: 1 },
    { id: 'drill-i-VI-VII-i', label: 'i – VI – VII – i', scale: 'minor', steps: steps([0, 5, 6, 0], 'triad'), barsPerChord: 1 },
    { id: 'drill-i-iv-i-V', label: 'i – iv – i – V', scale: 'harmonicMinor', steps: steps([0, 3, 0, 4], 'seventh'), barsPerChord: 1 },
  ],
  rnb: [
    { id: 'rnb-I-vi-ii-V', label: 'Imaj9 – vi9 – ii9 – V9', scale: 'major', steps: steps([0, 5, 1, 4], 'ninth'), barsPerChord: 1 },
    { id: 'rnb-ii-V-I-vi', label: 'ii9 – V9 – Imaj9 – vi9', scale: 'major', steps: steps([1, 4, 0, 5], 'ninth'), barsPerChord: 1 },
    { id: 'rnb-neo-soul-minor', label: 'i9 – IV9 – bVIImaj9 – bIIImaj9', scale: 'dorian', steps: steps([0, 3, 6, 2], 'ninth'), barsPerChord: 1 },
  ],
  afro: [
    { id: 'afro-I-V-vi-IV', label: 'I – V – vi – IV', scale: 'major', steps: steps([0, 4, 5, 3], 'seventh'), barsPerChord: 1 },
    { id: 'afro-vi-IV-I-V', label: 'vi – IV – I – V', scale: 'major', steps: steps([5, 3, 0, 4], 'triad'), barsPerChord: 1 },
    { id: 'afro-i-VII-VI-VII', label: 'i – VII – VI – VII', scale: 'minor', steps: steps([0, 6, 5, 6], 'seventh'), barsPerChord: 1 },
  ],
};

export interface RealizedChord {
  notes: number[];
  startBar: number;
  bars: number;
  symbol: string;
}

/** Turn a progression into concrete chords in a key. `baseMidi` is the octave start (default C3 = 48). */
export function realizeProgression(prog: Progression, keyPc: number, baseMidi = 48): RealizedChord[] {
  const flats = prefersFlats(keyPc, prog.scale);
  return prog.steps.map((s, i) => {
    const notes = diatonicChord(baseMidi + keyPc, prog.scale, s.degree, s.extension) ?? [];
    return {
      notes,
      startBar: i * prog.barsPerChord,
      bars: prog.barsPerChord,
      symbol: detectChord(notes, flats)?.symbol ?? '?',
    };
  });
}
