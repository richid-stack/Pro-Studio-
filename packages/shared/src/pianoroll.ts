/**
 * Piano-roll geometry: how notes map to pixels and back, hit testing, snapping, zoom and scroll limits.
 * All pure, so every pointer interaction can be tested without a canvas. Rows run from MAX_NOTE at the top
 * to MIN_NOTE at the bottom; time runs in steps (a step is a 16th note) from the left.
 */
import { MAX_NOTE, MIN_NOTE } from './edit';
import type { Note } from './project';
import { clamp } from './theory';

export interface RollView {
  /** Pixels per step. */
  stepW: number;
  /** Pixels per semitone row. */
  rowH: number;
  /** Pixels scrolled from the left edge of the pattern. */
  scrollX: number;
  /** Pixels scrolled from the top row (MAX_NOTE). */
  scrollY: number;
}

export const ROLL_MIN_STEP_W = 6;
export const ROLL_MAX_STEP_W = 96;
export const ROLL_MIN_ROW_H = 8;
export const ROLL_MAX_ROW_H = 36;

export const rowCount = (): number => MAX_NOTE - MIN_NOTE + 1;

export const stepToX = (step: number, v: RollView): number => step * v.stepW - v.scrollX;
export const xToStep = (x: number, v: RollView): number => (x + v.scrollX) / v.stepW;
/** Top edge of the row for a pitch. */
export const pitchToY = (pitch: number, v: RollView): number => (MAX_NOTE - pitch) * v.rowH - v.scrollY;
export const yToPitch = (y: number, v: RollView): number => clamp(MAX_NOTE - Math.floor((y + v.scrollY) / v.rowH), MIN_NOTE, MAX_NOTE);

/** Snap a step position down to the grid (placing a new note under the pointer). */
export const snapDown = (step: number, grid: number): number => Math.floor(step / grid + 1e-9) * grid;
/** Snap to the nearest grid line (dragging an existing note). */
export const snapNearest = (step: number, grid: number): number => Math.round(step / grid) * grid;

export type HitZone = 'body' | 'start' | 'end';
export interface Hit {
  id: number;
  zone: HitZone;
}

/**
 * The topmost note under a point. The last `edgePx` of a note's width is its resize handle (the end);
 * a note narrower than three handles has no start handle, so tiny notes stay movable.
 */
export function hitTest(notes: readonly Note[], x: number, y: number, v: RollView, edgePx = 6): Hit | null {
  for (let i = notes.length - 1; i >= 0; i--) {
    const n = notes[i] as Note;
    const top = pitchToY(n.n, v);
    if (y < top || y >= top + v.rowH) continue;
    const left = stepToX(n.t, v);
    const right = stepToX(n.t + n.d, v);
    if (x < left || x > right) continue;
    const width = right - left;
    if (x >= right - Math.min(edgePx, width / 3)) return { id: n.id, zone: 'end' };
    if (width > edgePx * 3 && x <= left + edgePx) return { id: n.id, zone: 'start' };
    return { id: n.id, zone: 'body' };
  }
  return null;
}

export interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Ids of notes that touch a screen rectangle (rubber-band selection). */
export function notesInRect(notes: readonly Note[], r: Rect, v: RollView): number[] {
  const x1 = Math.min(r.x1, r.x2);
  const x2 = Math.max(r.x1, r.x2);
  const y1 = Math.min(r.y1, r.y2);
  const y2 = Math.max(r.y1, r.y2);
  return notes
    .filter((n) => {
      const left = stepToX(n.t, v);
      const right = stepToX(n.t + n.d, v);
      const top = pitchToY(n.n, v);
      return right >= x1 && left <= x2 && top + v.rowH >= y1 && top <= y2;
    })
    .map((n) => n.id);
}

export function clampScroll(v: RollView, viewW: number, viewH: number, totalSteps: number): RollView {
  const maxX = Math.max(0, totalSteps * v.stepW - viewW);
  const maxY = Math.max(0, rowCount() * v.rowH - viewH);
  return { ...v, scrollX: clamp(v.scrollX, 0, maxX), scrollY: clamp(v.scrollY, 0, maxY) };
}

/** Zoom time by `factor` keeping the step under `anchorX` where it is on screen. */
export function zoomX(v: RollView, factor: number, anchorX: number, viewW: number, totalSteps: number): RollView {
  const anchorStep = xToStep(anchorX, v);
  const stepW = clamp(v.stepW * factor, ROLL_MIN_STEP_W, ROLL_MAX_STEP_W);
  return clampScroll({ ...v, stepW, scrollX: anchorStep * stepW - anchorX }, viewW, Number.POSITIVE_INFINITY, totalSteps);
}

export function zoomY(v: RollView, factor: number, anchorY: number, viewH: number): RollView {
  const anchorRow = (anchorY + v.scrollY) / v.rowH;
  const rowH = clamp(v.rowH * factor, ROLL_MIN_ROW_H, ROLL_MAX_ROW_H);
  return clampScroll({ ...v, rowH, scrollY: anchorRow * rowH - anchorY }, Number.POSITIVE_INFINITY, viewH, 0);
}

/** Scroll so a pitch range sits in the middle of the view (open the roll where the notes are). */
export function centerOnPitch(v: RollView, pitch: number, viewH: number): RollView {
  return clampScroll({ ...v, scrollY: pitchToY(pitch, { ...v, scrollY: 0 }) + v.rowH / 2 - viewH / 2 }, Number.POSITIVE_INFINITY, viewH, 0);
}

/** Pitch range worth showing for a set of notes, padded; a default C3..C6 when empty. */
export function pitchSpan(notes: readonly Note[], pad = 4): { low: number; high: number } {
  if (notes.length === 0) return { low: 48, high: 84 };
  return { low: Math.max(MIN_NOTE, Math.min(...notes.map((n) => n.n)) - pad), high: Math.min(MAX_NOTE, Math.max(...notes.map((n) => n.n)) + pad) };
}

const BLACK = new Set([1, 3, 6, 8, 10]);
export const isBlackKey = (pitch: number): boolean => BLACK.has(((pitch % 12) + 12) % 12);

/** Grid choices for snapping, in steps: 1/4 note down to 1/64, plus triplets. */
export const SNAP_OPTIONS = [
  { id: 'off', label: 'Off', steps: 0.25 },
  { id: '1/4', label: '1/4', steps: 4 },
  { id: '1/8', label: '1/8', steps: 2 },
  { id: '1/16', label: '1/16', steps: 1 },
  { id: '1/32', label: '1/32', steps: 0.5 },
  { id: '1/64', label: '1/64', steps: 0.25 },
  { id: '1/8T', label: '1/8 triplet', steps: 4 / 3 },
  { id: '1/16T', label: '1/16 triplet', steps: 2 / 3 },
] as const;
export type SnapId = (typeof SNAP_OPTIONS)[number]['id'];

/** "bar.beat.step" position text, 1-based, for the readout and screen readers. */
export function formatPosition(step: number): string {
  const s = Math.max(0, step);
  const bar = Math.floor(s / 16) + 1;
  const beat = Math.floor((s % 16) / 4) + 1;
  const sub = Math.floor(s % 4) + 1;
  return `${bar}.${beat}.${sub}`;
}
