/** Which keys are sounding, from the laptop keyboard, the on-screen keys or the roll's key column. */
import { createStore, useStore } from './store';

const held = createStore<ReadonlySet<number>>(new Set());

export const heldNotes = {
  store: held,
  down(note: number): void {
    held.set((s) => (s.has(note) ? s : new Set(s).add(note)));
  },
  up(note: number): void {
    held.set((s) => {
      if (!s.has(note)) return s;
      const n = new Set(s);
      n.delete(note);
      return n;
    });
  },
  clear(): void {
    held.set((s) => (s.size === 0 ? s : new Set()));
  },
};

export const useHeldNotes = (): ReadonlySet<number> => useStore(held, (s) => s);
