import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_NOTE, MIN_NOTE, moveCursor, rollKeyAction, type RollKeyContext } from '../src/index';

const ctx = (over: Partial<RollKeyContext> = {}): RollKeyContext => ({ cursor: { step: 4, pitch: 60 }, grid: 1, total: 32, hasSelection: false, ...over });

describe('roll cursor', () => {
  it('arrows move by one grid cell and one semitone', () => {
    assert.deepEqual(rollKeyAction({ key: 'ArrowRight' }, ctx()), { type: 'cursor', cursor: { step: 5, pitch: 60 } });
    assert.deepEqual(rollKeyAction({ key: 'ArrowLeft' }, ctx({ grid: 4 })), { type: 'cursor', cursor: { step: 0, pitch: 60 } });
    assert.deepEqual(rollKeyAction({ key: 'ArrowUp' }, ctx()), { type: 'cursor', cursor: { step: 4, pitch: 61 } });
    assert.deepEqual(rollKeyAction({ key: 'PageDown' }, ctx()), { type: 'cursor', cursor: { step: 4, pitch: 48 } });
  });

  it('never leaves the pattern or the pitch range', () => {
    assert.equal(moveCursor({ step: 0, pitch: MIN_NOTE }, -5, -5, 1, 32).step, 0);
    assert.equal(moveCursor({ step: 0, pitch: MIN_NOTE }, -5, -5, 1, 32).pitch, MIN_NOTE);
    assert.equal(moveCursor({ step: 31, pitch: MAX_NOTE }, 5, 5, 1, 32).step, 31);
    assert.equal(moveCursor({ step: 31, pitch: MAX_NOTE }, 5, 5, 1, 32).pitch, MAX_NOTE);
  });

  it('with snapping off the cursor still moves in 64ths', () => {
    assert.deepEqual(rollKeyAction({ key: 'ArrowRight' }, ctx({ grid: 0 })), { type: 'cursor', cursor: { step: 4.25, pitch: 60 } });
  });

  it('Home and End jump to the ends of the pattern', () => {
    assert.deepEqual(rollKeyAction({ key: 'Home' }, ctx()), { type: 'cursor', cursor: { step: 0, pitch: 60 } });
    assert.deepEqual(rollKeyAction({ key: 'End' }, ctx()), { type: 'cursor', cursor: { step: 31, pitch: 60 } });
  });
});

describe('roll editing keys', () => {
  it('Enter adds a note at the cursor', () => {
    assert.deepEqual(rollKeyAction({ key: 'Enter' }, ctx()), { type: 'add', at: { step: 4, pitch: 60 } });
  });

  it('shift-arrows move the selection and alt-arrows resize it, but only when something is selected', () => {
    assert.equal(rollKeyAction({ key: 'ArrowRight', shift: true }, ctx()), null);
    assert.deepEqual(rollKeyAction({ key: 'ArrowRight', shift: true }, ctx({ hasSelection: true })), { type: 'move', dStep: 1, dPitch: 0 });
    assert.deepEqual(rollKeyAction({ key: 'ArrowUp', shift: true }, ctx({ hasSelection: true })), { type: 'move', dStep: 0, dPitch: 1 });
    assert.deepEqual(rollKeyAction({ key: 'ArrowLeft', alt: true }, ctx({ hasSelection: true })), { type: 'resize', dSteps: -1 });
    assert.equal(rollKeyAction({ key: 'ArrowUp', alt: true }, ctx({ hasSelection: true })), null);
  });

  it('delete, escape, velocity and duplicate need a selection', () => {
    for (const key of ['Delete', 'Backspace', 'Escape', '[', ']']) {
      assert.equal(rollKeyAction({ key }, ctx()), null, key);
      assert.notEqual(rollKeyAction({ key }, ctx({ hasSelection: true })), null, key);
    }
    assert.equal(rollKeyAction({ key: 'd', mod: true }, ctx()), null);
    assert.deepEqual(rollKeyAction({ key: 'd', mod: true }, ctx({ hasSelection: true })), { type: 'duplicate' });
    assert.deepEqual(rollKeyAction({ key: 'a', mod: true }, ctx()), { type: 'select-all' });
  });

  it('leaves unrelated keys to the app', () => {
    for (const key of [' ', 'z', 'q', 'F5', 'Tab']) assert.equal(rollKeyAction({ key }, ctx({ hasSelection: true })), null, key);
    assert.equal(rollKeyAction({ key: 's', mod: true }, ctx()), null);
  });
});
