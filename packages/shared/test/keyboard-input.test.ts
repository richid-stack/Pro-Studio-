import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TypingPiano, createTypingInput, isEditableTarget, keyLabel, type KeyboardEventLike, type PianoEvent } from '../src/index';

function setup() {
  const piano = new TypingPiano();
  const events: PianoEvent[] = [];
  const input = createTypingInput(piano, (e) => events.push(e));
  const press = (code: string, extra: Partial<KeyboardEventLike> = {}) => {
    const state = { prevented: false };
    input.keyDown({ code, preventDefault: () => (state.prevented = true), ...extra });
    return state;
  };
  return { piano, events, input, press };
}

test('a piano key plays a note, is swallowed, and stops on release', () => {
  const { events, input, press } = setup();
  const s = press('KeyA');
  assert.equal(s.prevented, true);
  assert.deepEqual(events, [{ type: 'noteOn', note: 60, velocity: 100, code: 'KeyA' }]);
  input.keyUp({ code: 'KeyA' });
  assert.deepEqual(events[1], { type: 'noteOff', note: 60, code: 'KeyA' });
});

test('typing in a text field never plays and is not swallowed', () => {
  const { events, press } = setup();
  for (const target of [
    { tagName: 'INPUT', type: 'text' },
    { tagName: 'INPUT' },
    { tagName: 'TEXTAREA' },
    { tagName: 'SELECT' },
    { tagName: 'DIV', isContentEditable: true },
    { tagName: 'DIV', getAttribute: (n: string) => (n === 'role' ? 'textbox' : null) },
  ]) {
    const s = press('KeyA', { target });
    assert.equal(s.prevented, false, JSON.stringify(target));
  }
  assert.equal(events.length, 0);
});

test('sliders, checkboxes and buttons do not block the piano', () => {
  assert.equal(isEditableTarget({ tagName: 'INPUT', type: 'range' }), false);
  assert.equal(isEditableTarget({ tagName: 'INPUT', type: 'checkbox' }), false);
  assert.equal(isEditableTarget({ tagName: 'BUTTON' }), false);
  assert.equal(isEditableTarget(null), false);
  assert.equal(isEditableTarget(undefined), false);
  const { events, press } = setup();
  press('KeyA', { target: { tagName: 'INPUT', type: 'range' } });
  assert.equal(events.length, 1);
});

test('browser shortcuts pass through', () => {
  const { events, press } = setup();
  for (const mod of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
    const s = press('KeyS', mod);
    assert.equal(s.prevented, false);
  }
  assert.equal(events.length, 0);
});

test('piano keys are swallowed on auto-repeat but do not retrigger', () => {
  const { events, press } = setup();
  press('KeyA');
  const s = press('KeyA', { repeat: true });
  assert.equal(s.prevented, true);
  assert.equal(events.filter((e) => e.type === 'noteOn').length, 1);
});

test('keys the piano does not own are left alone', () => {
  const { events, press } = setup();
  for (const code of ['Space', 'Enter', 'Tab', 'ArrowLeft', 'KeyQ', 'F5']) {
    assert.equal(press(code).prevented, false, code);
  }
  assert.equal(events.length, 0);
});

test('a note still stops if focus moved into a text field while it was held', () => {
  const { events, input, press } = setup();
  press('KeyA');
  input.keyUp({ code: 'KeyA' });
  assert.equal(events.at(-1)?.type, 'noteOff');
});

test('blur releases every held note', () => {
  const { events, input, press } = setup();
  press('KeyA');
  press('KeyD');
  input.blur();
  assert.deepEqual(events.filter((e) => e.type === 'noteOff').map((e) => (e as { note: number }).note).sort(), [60, 64]);
  assert.deepEqual(input && events.length, 4);
});

test('disabled piano ignores everything and does not swallow keys', () => {
  const { piano, events, press } = setup();
  piano.setEnabled(false);
  assert.equal(press('KeyA').prevented, false);
  assert.equal(events.length, 0);
});

test('key labels and offsets for the on-screen keyboard', () => {
  assert.equal(keyLabel('KeyA'), 'A');
  assert.equal(keyLabel('Digit5'), '5');
  assert.equal(keyLabel('Semicolon'), ';');
  assert.equal(keyLabel('Quote'), "'");
  const p = new TypingPiano();
  const m = p.keysByOffset();
  assert.deepEqual(m.get(0), ['KeyA']);
  assert.deepEqual(m.get(1), ['KeyW']);
  assert.equal(m.size, 18);
  p.setLayout('fl');
  assert.deepEqual(p.keysByOffset().get(12), ['Comma', 'KeyQ']); // two manuals: Z row's next octave and Q row
});
