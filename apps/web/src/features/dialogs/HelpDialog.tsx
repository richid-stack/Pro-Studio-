import { SHORTCUTS, formatShortcut } from '@pro-studio/shared';
import { Dialog } from '../../components/Dialog';
import { uiState, useUi } from '../../state/ui';

export const isMac = (): boolean => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const PIANO_ROWS: ReadonlyArray<[string, string]> = [
  ['Z X C V B N M', 'White keys, one octave'],
  ['S D  G H J', 'Black keys under them'],
  ['Q W E R T Y U', 'White keys, the next octave'],
  ['- and =', 'Move the keys down or up an octave'],
];

const ROLL_ROWS: ReadonlyArray<[string, string]> = [
  ['Arrow keys', 'Move the cursor by one grid cell or one semitone'],
  ['Page Up, Page Down', 'Move the cursor an octave'],
  ['Enter', 'Put a note at the cursor'],
  ['Shift+Arrows', 'Move the selected notes'],
  ['Alt+Left, Alt+Right', 'Shorten or lengthen the selected notes'],
  ['[ and ]', 'Soften or strengthen the selected notes'],
  ['Delete', 'Remove the selected notes'],
  ['Mod+A, Mod+D', 'Select all, duplicate the selection'],
];

const BROWSER_ROWS: ReadonlyArray<[string, string]> = [
  ['Arrow keys', 'Walk the list; Right opens a folder, Left closes it'],
  ['Home, End', 'Jump to the first or last row'],
  ['A letter', 'Jump to the next name that starts with it'],
  ['Space', 'Hear the sound (or open or close a folder)'],
  ['Enter', 'Add the sound, open the starter beat, or select the channel'],
  ['Alt+S', 'Star or unstar the sound or starter beat'],
];

export function HelpDialog() {
  const open = useUi((s) => s.helpOpen);
  const mac = isMac();
  const mod = (s: string): string => s.replace(/Mod\+?/g, mac ? '⌘' : 'Ctrl+');
  return (
    <Dialog open={open} onClose={() => uiState.setHelp(false)} title="Keyboard shortcuts">
      <h3 className="dialog-subtitle">Anywhere</h3>
      <dl className="shortcut-list">
        {SHORTCUTS.map((s) => (
          <div key={s.id} className="shortcut-row">
            <dt><kbd>{formatShortcut(s.keys, mac)}</kbd></dt>
            <dd>{s.label}</dd>
          </div>
        ))}
      </dl>
      <h3 className="dialog-subtitle">Playing notes</h3>
      <p className="muted">Your computer keyboard plays the channel selected in the rack, in the two-row layout most producers know.</p>
      <dl className="shortcut-list">
        {PIANO_ROWS.map(([k, d]) => (
          <div key={k} className="shortcut-row"><dt><kbd>{k}</kbd></dt><dd>{d}</dd></div>
        ))}
      </dl>
      <h3 className="dialog-subtitle">In the browser</h3>
      <dl className="shortcut-list">
        {BROWSER_ROWS.map(([k, d]) => (
          <div key={k} className="shortcut-row"><dt><kbd>{k}</kbd></dt><dd>{d}</dd></div>
        ))}
      </dl>
      <h3 className="dialog-subtitle">In the piano roll</h3>
      <dl className="shortcut-list">
        {ROLL_ROWS.map(([k, d]) => (
          <div key={k} className="shortcut-row"><dt><kbd>{mod(k)}</kbd></dt><dd>{d}</dd></div>
        ))}
      </dl>
    </Dialog>
  );
}
