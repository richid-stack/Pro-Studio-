/**
 * The app's global shortcuts, as data and a pure matcher. The matcher knows nothing about the DOM: the caller
 * says whether the key landed on a text field (`editable`) or on a control that uses the key itself, such as a
 * focused button that Space presses (`interactive`). Letters belong to the typing piano, so none are used here
 * except Shift+F.
 */
import type { PanelId } from './workspace';

export type ShortcutId =
  | 'play-pause' | 'stop' | 'undo' | 'redo' | 'save' | 'open' | 'export' | 'help' | 'maximize'
  | 'toggle-browser' | 'toggle-rack' | 'toggle-roll' | 'toggle-playlist' | 'toggle-mixer';

export interface ShortcutInfo {
  id: ShortcutId;
  /** How the keys read in the interface; `Mod` is Ctrl on Windows and Linux, Cmd on Mac. */
  keys: string;
  label: string;
}

export const SHORTCUTS: readonly ShortcutInfo[] = [
  { id: 'play-pause', keys: 'Space', label: 'Play or pause' },
  { id: 'stop', keys: 'Shift+Space', label: 'Stop and return to the start' },
  { id: 'undo', keys: 'Mod+Z', label: 'Undo' },
  { id: 'redo', keys: 'Mod+Shift+Z', label: 'Redo' },
  { id: 'save', keys: 'Mod+S', label: 'Save the project as a file' },
  { id: 'open', keys: 'Mod+O', label: 'Open a project file' },
  { id: 'export', keys: 'Mod+E', label: 'Export audio' },
  { id: 'toggle-browser', keys: 'Alt+1', label: 'Show or hide the browser' },
  { id: 'toggle-rack', keys: 'Alt+2', label: 'Show or hide the channel rack' },
  { id: 'toggle-roll', keys: 'Alt+3', label: 'Show or hide the piano roll' },
  { id: 'toggle-playlist', keys: 'Alt+4', label: 'Show or hide the playlist' },
  { id: 'toggle-mixer', keys: 'Alt+5', label: 'Show or hide the mixer' },
  { id: 'maximize', keys: 'Shift+F', label: 'Maximize the panel you are in, or restore it' },
  { id: 'help', keys: '?', label: 'Show the keyboard shortcuts' },
];

export const PANEL_FOR_TOGGLE: Readonly<Partial<Record<ShortcutId, PanelId>>> = {
  'toggle-browser': 'browser',
  'toggle-rack': 'rack',
  'toggle-roll': 'roll',
  'toggle-playlist': 'playlist',
  'toggle-mixer': 'mixer',
};

export interface KeyPress {
  key: string;
  code: string;
  shift: boolean;
  /** Ctrl or Cmd. */
  mod: boolean;
  alt: boolean;
  /** The key landed in a text field. */
  editable: boolean;
  /** The key landed on a button, menu item or similar that handles Space and Enter itself. */
  interactive: boolean;
  /** A modal dialog is open. */
  modalOpen: boolean;
}

const DIGIT_TOGGLES: Record<string, ShortcutId> = {
  Digit1: 'toggle-browser',
  Digit2: 'toggle-rack',
  Digit3: 'toggle-roll',
  Digit4: 'toggle-playlist',
  Digit5: 'toggle-mixer',
};

export function matchShortcut(k: KeyPress): ShortcutId | null {
  if (k.modalOpen) return null;

  if (k.mod && !k.alt) {
    const key = k.key.toLowerCase();
    if (key === 'z') return k.shift ? 'redo' : 'undo';
    if (key === 'y' && !k.shift) return 'redo';
    if (k.editable) return null; // let a text field keep its own undo, and so on
    if (key === 's' && !k.shift) return 'save';
    if (key === 'o' && !k.shift) return 'open';
    if (key === 'e' && !k.shift) return 'export';
    return null;
  }

  if (k.editable) return null;
  if (k.alt && !k.mod && !k.shift) return DIGIT_TOGGLES[k.code] ?? null;
  if (k.alt || k.mod) return null;

  if (k.code === 'Space' && !k.interactive) return k.shift ? 'stop' : 'play-pause';
  if (k.key === '?' || k.key === 'F1') return k.interactive && k.key === '?' ? null : 'help';
  if (k.shift && k.code === 'KeyF' && !k.interactive) return 'maximize';
  return null;
}

/** "Mod+Shift+Z" as the platform writes it: Ctrl+Shift+Z, or the Mac symbols. */
export function formatShortcut(keys: string, mac: boolean): string {
  return keys
    .split('+')
    .map((part) => {
      if (part === 'Mod') return mac ? '⌘' : 'Ctrl';
      if (mac && part === 'Shift') return '⇧';
      if (mac && part === 'Alt') return '⌥';
      return part;
    })
    .join(mac ? '' : '+');
}
