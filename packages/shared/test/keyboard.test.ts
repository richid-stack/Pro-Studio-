import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TypingPiano } from '../src/index';

test('home row plays white keys, row above plays black keys (Ableton layout)', () => {
  const p = new TypingPiano();
  const notes = ['KeyA', 'KeyW', 'KeyS', 'KeyE', 'KeyD', 'KeyF', 'KeyT', 'KeyG', 'KeyY', 'KeyH', 'KeyU', 'KeyJ', 'KeyK'].map((code) => {
    const ev = p.keyDown({ code });
    p.keyUp({ code });
    const first = ev[0];
    assert.ok(first && first.type === 'noteOn', code);
    return first.note;
  });
  assert.deepEqual(notes, [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72]);
});

test('key repeat does not retrigger and release stops the same note', () => {
  const p = new TypingPiano();
  assert.equal(p.keyDown({ code: 'KeyA' }).length, 1);
  assert.equal(p.keyDown({ code: 'KeyA', repeat: true }).length, 0);
  assert.equal(p.keyDown({ code: 'KeyA' }).length, 0); // already held
  assert.deepEqual(p.keyUp({ code: 'KeyA' }), [{ type: 'noteOff', note: 60, code: 'KeyA' }]);
  assert.deepEqual(p.keyUp({ code: 'KeyA' }), []); // nothing to release twice
});

test('octave change while a key is held still releases the original note', () => {
  const p = new TypingPiano();
  p.keyDown({ code: 'KeyA' }); // 60
  assert.deepEqual(p.keyDown({ code: 'KeyX' }), [{ type: 'octave', baseMidi: 72 }]);
  assert.deepEqual(p.keyUp({ code: 'KeyA' }), [{ type: 'noteOff', note: 60, code: 'KeyA' }]);
  const on = p.keyDown({ code: 'KeyA' })[0];
  assert.ok(on && on.type === 'noteOn' && on.note === 72);
});

test('octave range is limited', () => {
  const p = new TypingPiano({ baseMidi: 96 });
  assert.deepEqual(p.keyDown({ code: 'KeyX' }), []);
  const q = new TypingPiano({ baseMidi: 12 });
  assert.deepEqual(q.keyDown({ code: 'KeyZ' }), []);
});

test('velocity keys step by 16 and clamp', () => {
  const p = new TypingPiano({ velocity: 100 });
  assert.deepEqual(p.keyDown({ code: 'KeyV' }), [{ type: 'velocity', velocity: 116 }]);
  assert.deepEqual(p.keyDown({ code: 'KeyV' }), [{ type: 'velocity', velocity: 127 }]);
  assert.deepEqual(p.keyDown({ code: 'KeyV' }), []);
  const on = p.keyDown({ code: 'KeyA' })[0];
  assert.ok(on && on.type === 'noteOn' && on.velocity === 127);
});

test('shortcuts with Ctrl, Cmd or Alt are never swallowed by the piano', () => {
  const p = new TypingPiano();
  assert.deepEqual(p.keyDown({ code: 'KeyS', ctrlKey: true }), []);
  assert.deepEqual(p.keyDown({ code: 'KeyZ', metaKey: true }), []);
  assert.deepEqual(p.keyDown({ code: 'KeyA', altKey: true }), []);
});

test('disabling releases held notes and ignores keys until re-enabled', () => {
  const p = new TypingPiano();
  p.keyDown({ code: 'KeyA' });
  p.keyDown({ code: 'KeyD' });
  const off = p.setEnabled(false);
  assert.equal(off.length, 2);
  assert.deepEqual(p.keyDown({ code: 'KeyA' }), []);
  p.setEnabled(true);
  assert.equal(p.keyDown({ code: 'KeyA' }).length, 1);
});

test('FL layout: two rows, Z row is the current octave and Q row is the next', () => {
  const p = new TypingPiano({ layout: 'fl' });
  const play = (code: string) => {
    const ev = p.keyDown({ code })[0];
    p.keyUp({ code });
    assert.ok(ev && ev.type === 'noteOn', code);
    return ev.note;
  };
  assert.equal(play('KeyZ'), 60);
  assert.equal(play('KeyS'), 61);
  assert.equal(play('KeyX'), 62);
  assert.equal(play('KeyM'), 71);
  assert.equal(play('KeyQ'), 72);
  assert.equal(play('KeyP'), 88);
  assert.deepEqual(p.keyDown({ code: 'Equal' }), [{ type: 'octave', baseMidi: 72 }]);
  assert.deepEqual(p.keyDown({ code: 'KeyV' }), [{ type: 'noteOn', note: 77, velocity: 100, code: 'KeyV' }]); // V is a note here, not velocity
});

test('changing layout releases held notes and handles() follows the layout', () => {
  const p = new TypingPiano();
  p.keyDown({ code: 'KeyA' });
  assert.equal(p.handles('KeyA'), true);
  assert.equal(p.handles('Space'), false);
  assert.equal(p.handles('KeyZ'), true); // octave key
  assert.equal(p.setLayout('fl').length, 1);
  assert.equal(p.handles('Comma'), true);
});

test('the highest key on the highest octave is still a valid MIDI note', () => {
  const p = new TypingPiano({ baseMidi: 96, layout: 'fl' });
  const ev = p.keyDown({ code: 'KeyP' })[0];
  assert.ok(ev && ev.type === 'noteOn');
  assert.equal(ev.note, 124);
  assert.ok(ev.note <= 127);
});
