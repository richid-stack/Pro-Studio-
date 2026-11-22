import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MIN_VELOCITY, velocityBarsAt, velocityFromY, yFromVelocity, type Note, type RollView } from '../src/index';

const view: RollView = { stepW: 20, rowH: 14, scrollX: 0, scrollY: 0 };
const note = (id: number, t: number, n = 60): Note => ({ id, t, d: 1, n, v: 0.8, s: false });

describe('velocity lane height', () => {
  it('top is full, bottom is the floor, and out-of-range pointers clamp', () => {
    assert.equal(velocityFromY(0, 100), 1);
    assert.equal(velocityFromY(100, 100), MIN_VELOCITY);
    assert.equal(velocityFromY(-40, 100), 1);
    assert.equal(velocityFromY(400, 100), MIN_VELOCITY);
    assert.ok(Math.abs(velocityFromY(50, 100) - 0.5) < 1e-9);
  });
  it('survives a zero-height lane', () => {
    assert.ok(Number.isFinite(velocityFromY(10, 0)));
  });
  it('round-trips with yFromVelocity', () => {
    for (const v of [0.1, 0.5, 0.8, 1]) assert.ok(Math.abs(velocityFromY(yFromVelocity(v, 120), 120) - v) < 1e-9);
  });
});

describe('which bar a press grabs', () => {
  const notes = [note(1, 0), note(2, 4), note(3, 4, 64), note(4, 8)];
  it('grabs nothing when no bar is within tolerance', () => {
    assert.deepEqual(velocityBarsAt(notes, 50, view), []);
    assert.deepEqual(velocityBarsAt([], 0, view), []);
  });
  it('grabs every note that starts at the nearest bar (a chord is one bar)', () => {
    assert.deepEqual(velocityBarsAt(notes, 4 * 20 + 2, view).sort(), [2, 3]);
  });
  it('prefers the nearer of two bars inside tolerance', () => {
    const close = [note(1, 0), note(2, 0.5)];
    assert.deepEqual(velocityBarsAt(close, 9, view, 6), [2]);
    assert.deepEqual(velocityBarsAt(close, 1, view, 6), [1]);
  });
  it('follows horizontal scroll', () => {
    assert.deepEqual(velocityBarsAt(notes, 4 * 20 - 100 + 1, { ...view, scrollX: 100 }), [2, 3]);
  });
});
