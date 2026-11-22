/**
 * The velocity lane under the piano roll: one bar per note start, tall for loud and short for soft.
 * Pure geometry so the pointer rules (which notes a press grabs, what a height means) are tested without a canvas.
 */
import { stepToX, type RollView } from './pianoroll';
import type { Note } from './project';
import { clamp } from './theory';

/** The lowest velocity a drag can set; matches the floor the edit functions enforce. */
export const MIN_VELOCITY = 0.05;

/** The velocity a pointer height means: the top of the lane is full, the bottom is the floor. */
export function velocityFromY(y: number, laneH: number): number {
  return clamp(1 - y / Math.max(1, laneH), MIN_VELOCITY, 1);
}

/** Where the top of a velocity bar sits, in lane pixels from the top. */
export function yFromVelocity(velocity: number, laneH: number): number {
  return (1 - clamp(velocity, 0, 1)) * laneH;
}

/**
 * The notes a press at `x` grabs: every note that starts at the bar nearest to the pointer, within `tolPx`.
 * A chord is one bar to look at, so it is one bar to drag. Empty when no bar is close enough.
 */
export function velocityBarsAt(notes: readonly Note[], x: number, view: RollView, tolPx = 6): number[] {
  let nearest = Number.POSITIVE_INFINITY;
  let start: number | null = null;
  for (const n of notes) {
    const d = Math.abs(stepToX(n.t, view) - x);
    if (d <= tolPx && d < nearest - 1e-9) {
      nearest = d;
      start = n.t;
    }
  }
  if (start === null) return [];
  return notes.filter((n) => Math.abs(n.t - start) < 1e-9).map((n) => n.id);
}
