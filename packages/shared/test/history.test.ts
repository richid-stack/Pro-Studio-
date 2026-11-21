import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canRedo, canUndo, commit, createHistory, redo, undo } from '../src/index';

describe('history', () => {
  it('undoes and redoes in order, and a new edit clears the redo branch', () => {
    let h = createHistory(1);
    h = commit(h, 2);
    h = commit(h, 3);
    assert.equal(h.present, 3);
    h = undo(h);
    assert.equal(h.present, 2);
    h = undo(h);
    assert.equal(h.present, 1);
    assert.equal(canUndo(h), false);
    assert.equal(undo(h), h);
    h = redo(h);
    assert.equal(h.present, 2);
    h = commit(h, 9);
    assert.equal(canRedo(h), false);
    assert.equal(h.present, 9);
    assert.equal(undo(h).present, 2);
  });

  it('ignores a commit that changes nothing', () => {
    const obj = {};
    const h = createHistory(obj);
    assert.equal(commit(h, obj), h);
  });

  it('merges a drag into one undo step, but not across keys or after a pause', () => {
    let h = createHistory(0);
    for (let i = 1; i <= 20; i++) h = commit(h, i, { key: 'fader:kick', now: 1000 + i * 10 });
    assert.equal(h.present, 20);
    assert.equal(h.past.length, 1);
    assert.equal(undo(h).present, 0, 'one undo undoes the whole drag');
    h = commit(h, 100, { key: 'fader:snare', now: 1300 });
    assert.equal(h.past.length, 2, 'another control is another step');
    h = commit(h, 101, { key: 'fader:snare', now: 5000 });
    assert.equal(h.past.length, 3, 'a long pause starts a new step');
  });

  it('keeps at most `limit` steps', () => {
    let h = createHistory(0);
    for (let i = 1; i <= 50; i++) h = commit(h, i, { limit: 10 });
    assert.equal(h.past.length, 10);
    assert.equal(h.past[0], 40);
  });

  it('after undo, the next keyed edit does not merge into an older step', () => {
    let h = createHistory(0);
    h = commit(h, 1, { key: 'a', now: 100 });
    h = undo(h);
    h = commit(h, 2, { key: 'a', now: 150 });
    assert.equal(h.past.length, 1);
    assert.equal(undo(h).present, 0);
  });
});
