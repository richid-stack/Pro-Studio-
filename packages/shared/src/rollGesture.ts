/**
 * Piano-roll pointer gestures as pure functions. A gesture remembers the project as it was when the pointer
 * went down; every pointer move recomputes the result from that base, so a drag is idempotent and the history
 * can merge it into one undo step.
 */
import { addNote, moveNotes, resizeNotes, setNoteLength, setNoteVelocity } from './edit';
import type { Project } from './project';
import { snapDown, snapNearest } from './pianoroll';

export type RollGesture =
  | { kind: 'draw'; channelId: string; noteId: number; startStep: number; grid: number }
  | { kind: 'move'; channelId: string; ids: ReadonlySet<number>; fromStep: number; fromPitch: number; grid: number }
  | { kind: 'resize'; channelId: string; ids: ReadonlySet<number>; fromStep: number; grid: number }
  | { kind: 'velocity'; channelId: string; ids: ReadonlySet<number> };

export interface RollPoint {
  /** Position in steps (fractional). */
  step: number;
  /** MIDI note number under the pointer. */
  pitch: number;
}

/** The shortest note a drag can make: one grid cell, or a 64th when snapping is off. */
const minLength = (grid: number): number => (grid > 0 ? grid : 0.25);

/** Snap a drag distance: to whole grid cells, or leave it free when `grid` is 0. */
const snapDelta = (delta: number, grid: number): number => (grid > 0 ? snapNearest(delta, grid) : delta);

/** Put a new note under the pointer. Its start snaps down to the grid line the pointer is in. */
export function beginDraw(
  p: Project,
  channelId: string,
  at: RollPoint,
  grid: number,
  velocity = 0.8,
): { project: Project; gesture: RollGesture } {
  const start = grid > 0 ? snapDown(at.step, grid) : at.step;
  const { project, id } = addNote(p, channelId, { t: start, d: minLength(grid), n: at.pitch, v: velocity, s: false });
  return { project, gesture: { kind: 'draw', channelId, noteId: id, startStep: start, grid } };
}

export function beginMove(ids: ReadonlySet<number>, channelId: string, from: RollPoint, grid: number): RollGesture {
  return { kind: 'move', channelId, ids, fromStep: from.step, fromPitch: from.pitch, grid };
}

export function beginResize(ids: ReadonlySet<number>, channelId: string, from: RollPoint, grid: number): RollGesture {
  return { kind: 'resize', channelId, ids, fromStep: from.step, grid };
}

export function beginVelocity(ids: ReadonlySet<number>, channelId: string): RollGesture {
  return { kind: 'velocity', channelId, ids };
}

/**
 * The project after the pointer has moved to `to`. `base` is the project at pointer down (for a draw, the
 * project right after the new note was added). `value` is 0..1 and only used by the velocity gesture.
 */
export function applyGesture(base: Project, g: RollGesture, to: RollPoint, value = 0.8): Project {
  switch (g.kind) {
    case 'draw': {
      const end = g.grid > 0 ? snapNearest(to.step, g.grid) : to.step;
      return setNoteLength(base, g.channelId, new Set([g.noteId]), Math.max(minLength(g.grid), end - g.startStep));
    }
    case 'move':
      return moveNotes(base, g.channelId, g.ids, snapDelta(to.step - g.fromStep, g.grid), to.pitch - g.fromPitch);
    case 'resize':
      return resizeNotes(base, g.channelId, g.ids, snapDelta(to.step - g.fromStep, g.grid));
    case 'velocity':
      return setNoteVelocity(base, g.channelId, g.ids, value);
  }
}
