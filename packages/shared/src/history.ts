/**
 * Undo and redo as immutable snapshots. Projects are plain JSON and every edit returns a new object, so a
 * snapshot is just a reference: no diffing, no inverse operations to get wrong.
 */
export interface History<T> {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
  /** Key and time of the last commit, so a drag of a fader or a note becomes one undo step. */
  readonly lastKey: string | null;
  readonly lastAt: number;
}

export interface CommitOptions {
  /** Commits with the same key within `coalesceMs` replace the present instead of adding a step. */
  key?: string;
  coalesceMs?: number;
  /** Time source, injectable for tests. */
  now?: number;
  /** Most undo steps kept. */
  limit?: number;
}

export const createHistory = <T>(present: T): History<T> => ({ past: [], present, future: [], lastKey: null, lastAt: 0 });

export function commit<T>(h: History<T>, next: T, o: CommitOptions = {}): History<T> {
  if (Object.is(next, h.present)) return h;
  const now = o.now ?? Date.now();
  const joins = o.key !== undefined && o.key === h.lastKey && now - h.lastAt <= (o.coalesceMs ?? 600) && h.past.length > 0;
  if (joins) return { ...h, present: next, future: [], lastAt: now };
  const limit = o.limit ?? 200;
  const past = [...h.past, h.present];
  return { past: past.length > limit ? past.slice(past.length - limit) : past, present: next, future: [], lastKey: o.key ?? null, lastAt: now };
}

export const canUndo = <T>(h: History<T>): boolean => h.past.length > 0;
export const canRedo = <T>(h: History<T>): boolean => h.future.length > 0;

export function undo<T>(h: History<T>): History<T> {
  const prev = h.past[h.past.length - 1];
  if (prev === undefined) return h;
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future], lastKey: null, lastAt: 0 };
}

export function redo<T>(h: History<T>): History<T> {
  const next = h.future[0];
  if (next === undefined) return h;
  return { past: [...h.past, h.present], present: next, future: h.future.slice(1), lastKey: null, lastAt: 0 };
}

/** Replace the present without recording a step (loading a project, applying a preset). Clears history. */
export const reset = <T>(present: T): History<T> => createHistory(present);
