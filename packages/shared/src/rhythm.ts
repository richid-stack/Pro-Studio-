/**
 * Rhythm maths shared by the sequencer, the piano roll and the pattern generators: pure functions,
 * no DOM, no audio. Time is in ticks; a quarter note is PPQ ticks.
 */
import { clamp } from './theory';

/** Pulses per quarter note. Divisible by 2, 3, 4, 5, 6, 8, 12, 16 so triplets and 64ths land on whole ticks. */
export const PPQ = 960;
/** A 16th note, the step of the drum grid. */
export const STEP_TICKS = PPQ / 4;

/**
 * Swing: delays the second 16th of every pair. `swing` 0 is straight, 1 puts the off-beat 16th at 75% of
 * the pair (a hard shuffle). Positions on a pair boundary never move, and the mapping is monotonic, so
 * note order is preserved. Applied to note-ons and note-offs alike so durations stay sensible.
 */
export function swingTick(tick: number, swing: number, ppq: number = PPQ): number {
  const amount = clamp(swing, 0, 1);
  if (amount === 0) return tick;
  const step = ppq / 4;
  const pair = step * 2;
  const pairStart = Math.floor(tick / pair) * pair;
  const w = (tick - pairStart) / step; // 0..2, in steps
  const off = 1 + amount * 0.5; // where the second step of the pair starts, in steps
  const pos = w < 1 ? w * off : off + (w - 1) * (2 - off);
  return pairStart + pos * step;
}

export type RollShape = 'flat' | 'up' | 'down' | 'updown';

export interface RollOptions {
  startTick: number;
  lengthTicks: number;
  /** Number of hits spread evenly across the length. */
  hits: number;
  shape?: RollShape;
  /** Peak velocity, 0..1. Default 0.9. */
  velocity?: number;
  /** Velocity at the quiet end of a shaped roll, 0..1. Default 0.35. */
  minVelocity?: number;
  /** 0..1 amount of random velocity variation. Deterministic for a given seed. Default 0. */
  humanize?: number;
  seed?: number;
}

export interface RollHit {
  tick: number;
  velocity: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A hi-hat roll or ratchet: `hits` evenly spaced notes with a velocity shape. */
export function buildRoll(o: RollOptions): RollHit[] {
  const hits = Math.max(1, Math.floor(o.hits));
  const peak = clamp(o.velocity ?? 0.9, 0.05, 1);
  const low = clamp(o.minVelocity ?? 0.35, 0.05, peak);
  const shape = o.shape ?? 'flat';
  const human = clamp(o.humanize ?? 0, 0, 1);
  const rand = mulberry32(o.seed ?? 1);
  const out: RollHit[] = [];
  for (let i = 0; i < hits; i++) {
    const u = hits === 1 ? 1 : i / (hits - 1);
    let v = peak;
    if (shape === 'up') v = low + (peak - low) * u;
    else if (shape === 'down') v = peak - (peak - low) * u;
    else if (shape === 'updown') v = low + (peak - low) * (1 - Math.abs(2 * u - 1));
    if (human > 0) v += (rand() - 0.5) * human * 0.3;
    out.push({ tick: o.startTick + Math.round((i * o.lengthTicks) / hits), velocity: clamp(v, 0.05, 1) });
  }
  return out;
}

/** Notes per 16th step for the usual roll densities: 2 = 32nds, 3 = triplets, 4 = 64ths, 6, 8. */
export const ROLL_DIVISIONS = [2, 3, 4, 6, 8] as const;
