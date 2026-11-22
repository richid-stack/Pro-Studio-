/**
 * The open project and its undo history, plus everything that happens when it changes: the audio engine is
 * told, and the work is saved locally. Edits are pure functions from @pro-studio/shared, so this file only
 * wires them to history, the engine and storage.
 */
import {
  canRedo, canUndo, commit, createHistory, createStarterProject, parseProjectJson, redo, undo,
  type CommitOptions, type Genre, type History, type Project,
} from '@pro-studio/shared';
import { audioHost } from '../audio/audioHost';
import { createStore, safeStorage, useStore } from './store';

const STORAGE_KEY = 'prostudio.project.v1';
const SAVE_DELAY_MS = 400;

function initialProject(): Project {
  const saved = safeStorage.read(STORAGE_KEY);
  if (saved) {
    const r = parseProjectJson(saved);
    if (r.ok) return r.project;
  }
  return createStarterProject('trap');
}

const store = createStore<History<Project>>(createHistory(initialProject()));

let syncQueued = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function afterChange(): void {
  // one message per frame, however many edits a drag produced
  if (!syncQueued) {
    syncQueued = true;
    queueMicrotask(() => {
      syncQueued = false;
      audioHost.send({ type: 'setProject', project: store.get().present });
    });
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => safeStorage.write(STORAGE_KEY, JSON.stringify(store.get().present)), SAVE_DELAY_MS);
}

export const studio = {
  store,
  get: (): Project => store.get().present,
  /** Apply a pure edit. Pass `key` to merge a drag (a fader, a note) into one undo step. */
  edit(fn: (p: Project) => Project, opts?: CommitOptions): void {
    const prev = store.get();
    const next = commit(prev, fn(prev.present), opts);
    if (next === prev) return;
    store.set(next);
    afterChange();
  },
  undo(): void {
    store.set(undo(store.get()));
    afterChange();
  },
  redo(): void {
    store.set(redo(store.get()));
    afterChange();
  },
  canUndo: (): boolean => canUndo(store.get()),
  canRedo: (): boolean => canRedo(store.get()),
  /** Replace the project (new, open, example). Clears undo history. */
  load(p: Project): void {
    store.set(createHistory(p));
    afterChange();
  },
  /** Swap in a different project as an edit, so Undo brings the previous one back (starters, opening a file). */
  replace(p: Project): void {
    const prev = store.get();
    store.set(commit(prev, p));
    afterChange();
  },
  newFromStarter(genre: Genre): void {
    this.load(createStarterProject(genre));
  },
  /** Push the current project to the engine; call once at startup so the first play has something to play. */
  syncNow(): void {
    audioHost.send({ type: 'setProject', project: store.get().present });
  },
};

export const useProject = (): Project => useStore(store, (h) => h.present);
export const useCanUndo = (): boolean => useStore(store, (h) => h.past.length > 0);
export const useCanRedo = (): boolean => useStore(store, (h) => h.future.length > 0);
