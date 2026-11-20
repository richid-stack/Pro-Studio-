/**
 * Glue between raw key events and TypingPiano, with no DOM dependency so it can be tested in Node.
 * The app wires `keyDown` / `keyUp` / `blur` to window listeners and plays whatever `emit` receives.
 *
 * Rules that make laptop-keyboard playing feel right:
 *  - Typing in a text field never plays notes.
 *  - Ctrl/Cmd/Alt combinations are left to the browser and the app's own shortcuts.
 *  - Keys the piano owns are swallowed (preventDefault) even on auto-repeat, so Firefox quick-find and
 *    page scrolling do not fire while playing.
 *  - A key that started a note always stops it on release, even if focus moved to a text field meanwhile.
 *  - Losing window focus releases every held note, so nothing sticks.
 */
import type { PianoEvent, TypingPiano } from './keyboard';

export interface KeyboardEventLike {
  code: string;
  repeat?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  target?: unknown;
  preventDefault(): void;
}

const NON_TEXT_INPUT_TYPES = new Set(['button', 'checkbox', 'radio', 'range', 'color', 'file', 'submit', 'reset', 'image']);
const TEXT_ROLES = new Set(['textbox', 'searchbox', 'combobox', 'spinbutton']);

/** True when keystrokes on this element are text entry and must not be treated as piano keys. */
export function isEditableTarget(target: unknown): boolean {
  if (typeof target !== 'object' || target === null) return false;
  const t = target as { tagName?: unknown; type?: unknown; isContentEditable?: unknown; getAttribute?: (n: string) => string | null };
  if (t.isContentEditable === true) return true;
  const tag = typeof t.tagName === 'string' ? t.tagName.toUpperCase() : '';
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = typeof t.type === 'string' ? t.type.toLowerCase() : 'text';
    return !NON_TEXT_INPUT_TYPES.has(type);
  }
  const role = typeof t.getAttribute === 'function' ? t.getAttribute('role') : null;
  return role !== null && TEXT_ROLES.has(role);
}

export interface TypingInput {
  keyDown(e: KeyboardEventLike): void;
  keyUp(e: Pick<KeyboardEventLike, 'code'>): void;
  /** Window blur or tab hidden: release everything. */
  blur(): void;
}

export function createTypingInput(piano: TypingPiano, emit: (e: PianoEvent) => void): TypingInput {
  return {
    keyDown(e) {
      if (isEditableTarget(e.target)) return;
      if (!piano.isEnabled || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!piano.handles(e.code)) return;
      e.preventDefault();
      for (const ev of piano.keyDown(e)) emit(ev);
    },
    keyUp(e) {
      for (const ev of piano.keyUp(e)) emit(ev);
    },
    blur() {
      for (const ev of piano.releaseAll()) emit(ev);
    },
  };
}
