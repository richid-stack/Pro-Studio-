/**
 * Keyboard control of the piano roll, as a pure mapping from a key press to an action. The roll keeps a
 * cursor (a step and a pitch); arrows move it, Enter puts a note there, and the other keys edit the selection.
 * This is how the roll is used without a pointer, so every command a mouse can do has a key here.
 * Letters are left to the typing piano (Q, W, E... are notes); quantize is a button in the roll's toolbar.
 */
import { MAX_NOTE, MIN_NOTE } from './edit';
import { clamp } from './theory';

export interface RollCursor {
  step: number;
  pitch: number;
}

export type RollKeyAction =
  | { type: 'cursor'; cursor: RollCursor }
  | { type: 'add'; at: RollCursor }
  | { type: 'delete' }
  | { type: 'move'; dStep: number; dPitch: number }
  | { type: 'resize'; dSteps: number }
  | { type: 'select-all' }
  | { type: 'clear-selection' }
  | { type: 'duplicate' }
  | { type: 'velocity'; delta: number };

export interface RollKeyContext {
  cursor: RollCursor;
  /** Snap size in steps; the cursor moves by this much. */
  grid: number;
  /** Pattern length in steps. */
  total: number;
  hasSelection: boolean;
}

export interface RollKey {
  key: string;
  shift?: boolean;
  /** Ctrl or Cmd. */
  mod?: boolean;
  alt?: boolean;
}

export const VELOCITY_KEY_STEP = 0.1;

export function moveCursor(c: RollCursor, dStep: number, dPitch: number, grid: number, total: number): RollCursor {
  const g = grid > 0 ? grid : 0.25;
  return {
    step: clamp(Math.round((c.step + dStep) / g) * g, 0, Math.max(0, total - g)),
    pitch: clamp(c.pitch + dPitch, MIN_NOTE, MAX_NOTE),
  };
}

/** What a key does in the roll, or null when the roll leaves it alone (so the app's own shortcuts still work). */
export function rollKeyAction(k: RollKey, ctx: RollKeyContext): RollKeyAction | null {
  const g = ctx.grid > 0 ? ctx.grid : 0.25;
  const mod = Boolean(k.mod);

  if (mod) {
    if (k.key === 'a' || k.key === 'A') return { type: 'select-all' };
    if (k.key === 'd' || k.key === 'D') return ctx.hasSelection ? { type: 'duplicate' } : null;
    return null;
  }

  const arrow: Record<string, [number, number]> = {
    ArrowLeft: [-g, 0],
    ArrowRight: [g, 0],
    ArrowUp: [0, 1],
    ArrowDown: [0, -1],
  };
  const dir = arrow[k.key];
  if (dir) {
    const [dStep, dPitch] = dir;
    if (k.alt) return ctx.hasSelection && dStep !== 0 ? { type: 'resize', dSteps: dStep } : null;
    if (k.shift) return ctx.hasSelection ? { type: 'move', dStep, dPitch } : null;
    return { type: 'cursor', cursor: moveCursor(ctx.cursor, dStep, dPitch, g, ctx.total) };
  }

  switch (k.key) {
    case 'PageUp':
      return { type: 'cursor', cursor: moveCursor(ctx.cursor, 0, 12, g, ctx.total) };
    case 'PageDown':
      return { type: 'cursor', cursor: moveCursor(ctx.cursor, 0, -12, g, ctx.total) };
    case 'Home':
      return { type: 'cursor', cursor: { ...ctx.cursor, step: 0 } };
    case 'End':
      return { type: 'cursor', cursor: { ...ctx.cursor, step: Math.max(0, ctx.total - g) } };
    case 'Enter':
      return { type: 'add', at: ctx.cursor };
    case 'Delete':
    case 'Backspace':
      return ctx.hasSelection ? { type: 'delete' } : null;
    case 'Escape':
      return ctx.hasSelection ? { type: 'clear-selection' } : null;
    case '[':
      return ctx.hasSelection ? { type: 'velocity', delta: -VELOCITY_KEY_STEP } : null;
    case ']':
      return ctx.hasSelection ? { type: 'velocity', delta: VELOCITY_KEY_STEP } : null;
    default:
      return null;
  }
}
