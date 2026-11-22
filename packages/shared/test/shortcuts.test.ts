import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SHORTCUTS, formatShortcut, matchShortcut, type KeyPress } from '../src/index';

const press = (over: Partial<KeyPress>): KeyPress => ({ key: '', code: '', shift: false, mod: false, alt: false, editable: false, interactive: false, modalOpen: false, ...over });

describe('global shortcuts', () => {
  it('Space plays and pauses, Shift+Space stops', () => {
    assert.equal(matchShortcut(press({ key: ' ', code: 'Space' })), 'play-pause');
    assert.equal(matchShortcut(press({ key: ' ', code: 'Space', shift: true })), 'stop');
  });

  it('Space is left to a focused button, which uses it to press itself', () => {
    assert.equal(matchShortcut(press({ key: ' ', code: 'Space', interactive: true })), null);
  });

  it('nothing fires while typing in a text field, except undo and redo which the field is allowed to keep for itself', () => {
    assert.equal(matchShortcut(press({ key: ' ', code: 'Space', editable: true })), null);
    assert.equal(matchShortcut(press({ key: 'F', code: 'KeyF', shift: true, editable: true })), null);
    assert.equal(matchShortcut(press({ key: 's', code: 'KeyS', mod: true, editable: true })), null);
  });

  it('undo and redo accept both redo spellings', () => {
    assert.equal(matchShortcut(press({ key: 'z', code: 'KeyZ', mod: true })), 'undo');
    assert.equal(matchShortcut(press({ key: 'Z', code: 'KeyZ', mod: true, shift: true })), 'redo');
    assert.equal(matchShortcut(press({ key: 'y', code: 'KeyY', mod: true })), 'redo');
  });

  it('file shortcuts need the modifier', () => {
    assert.equal(matchShortcut(press({ key: 's', code: 'KeyS', mod: true })), 'save');
    assert.equal(matchShortcut(press({ key: 'o', code: 'KeyO', mod: true })), 'open');
    assert.equal(matchShortcut(press({ key: 'e', code: 'KeyE', mod: true })), 'export');
    assert.equal(matchShortcut(press({ key: 's', code: 'KeyS' })), null);
  });

  it('Alt and a digit toggles a panel, by physical key so Mac option-characters still work', () => {
    assert.equal(matchShortcut(press({ key: '¡', code: 'Digit1', alt: true })), 'toggle-browser');
    assert.equal(matchShortcut(press({ key: '€', code: 'Digit3', alt: true })), 'toggle-roll');
    assert.equal(matchShortcut(press({ key: '5', code: 'Digit5', alt: true })), 'toggle-mixer');
    assert.equal(matchShortcut(press({ key: '6', code: 'Digit6', alt: true })), null);
  });

  it('Shift+F maximizes, a plain F is the piano\'s', () => {
    assert.equal(matchShortcut(press({ key: 'F', code: 'KeyF', shift: true })), 'maximize');
    assert.equal(matchShortcut(press({ key: 'f', code: 'KeyF' })), null);
  });

  it('? and F1 open the help', () => {
    assert.equal(matchShortcut(press({ key: '?', code: 'Slash', shift: true })), 'help');
    assert.equal(matchShortcut(press({ key: 'F1', code: 'F1' })), 'help');
  });

  it('nothing fires behind an open dialog', () => {
    assert.equal(matchShortcut(press({ key: ' ', code: 'Space', modalOpen: true })), null);
    assert.equal(matchShortcut(press({ key: 'z', code: 'KeyZ', mod: true, modalOpen: true })), null);
  });

  it('every listed shortcut is reachable by some key press', () => {
    const reachable = new Set([
      matchShortcut(press({ key: ' ', code: 'Space' })), matchShortcut(press({ key: ' ', code: 'Space', shift: true })),
      matchShortcut(press({ key: 'z', code: 'KeyZ', mod: true })), matchShortcut(press({ key: 'Z', code: 'KeyZ', mod: true, shift: true })),
      matchShortcut(press({ key: 's', code: 'KeyS', mod: true })), matchShortcut(press({ key: 'o', code: 'KeyO', mod: true })),
      matchShortcut(press({ key: 'e', code: 'KeyE', mod: true })), matchShortcut(press({ key: '?', code: 'Slash', shift: true })),
      matchShortcut(press({ key: 'F', code: 'KeyF', shift: true })),
      ...[1, 2, 3, 4, 5].map((n) => matchShortcut(press({ key: String(n), code: `Digit${n}`, alt: true }))),
    ]);
    for (const s of SHORTCUTS) assert.ok(reachable.has(s.id), s.id);
  });

  it('formats for both platforms', () => {
    assert.equal(formatShortcut('Mod+Shift+Z', false), 'Ctrl+Shift+Z');
    assert.equal(formatShortcut('Mod+Shift+Z', true), '⌘⇧Z');
    assert.equal(formatShortcut('Alt+1', true), '⌥1');
    assert.equal(formatShortcut('Space', false), 'Space');
  });
});
