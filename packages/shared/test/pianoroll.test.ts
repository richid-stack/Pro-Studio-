import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_NOTE, MIN_NOTE, ROLL_MAX_STEP_W, ROLL_MIN_STEP_W, centerOnPitch, clampScroll, formatPosition, hitTest, isBlackKey, notesInRect,
  pitchSpan, pitchToY, snapDown, snapNearest, stepToX, xToStep, yToPitch, zoomX, zoomY, type Note, type RollView,
} from '../src/index';

const view = (o: Partial<RollView> = {}): RollView => ({ stepW: 20, rowH: 14, scrollX: 0, scrollY: 0, ...o });
const note = (id: number, t: number, d: number, n: number): Note => ({ id, t, d, n, v: 0.8, s: false });

describe('coordinates', () => {
  it('maps steps and pitches to pixels and back, with scroll', () => {
    const v = view({ scrollX: 50, scrollY: 100 });
    for (const s of [0, 1.5, 16, 31.75]) assert.ok(Math.abs(xToStep(stepToX(s, v), v) - s) < 1e-9);
    for (const p of [MIN_NOTE, 40, 60, MAX_NOTE]) assert.equal(yToPitch(pitchToY(p, v) + 1, v), p);
    assert.equal(pitchToY(MAX_NOTE, view()), 0);
    assert.equal(pitchToY(MAX_NOTE - 1, view()), 14);
  });
  it('clamps pitch lookups outside the keyboard', () => {
    assert.equal(yToPitch(-500, view()), MAX_NOTE);
    assert.equal(yToPitch(1e6, view()), MIN_NOTE);
  });
  it('knows the black keys', () => {
    assert.deepEqual([60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71].map(isBlackKey), [false, true, false, true, false, false, true, false, true, false, true, false]);
    assert.equal(isBlackKey(-11), true);
  });
});

describe('snapping', () => {
  it('snaps down for placing and to the nearest for dragging', () => {
    assert.equal(snapDown(3.9, 1), 3);
    assert.equal(snapDown(4, 1), 4);
    assert.equal(snapNearest(3.6, 1), 4);
    assert.equal(snapDown(5.2, 0.5), 5);
    assert.ok(Math.abs(snapDown(2.1, 4 / 3) - 4 / 3) < 1e-9);
  });
});

describe('hitTest', () => {
  const v = view();
  const notes = [note(1, 4, 4, 60), note(2, 6, 2, 62), note(3, 0, 0.25, 64)];
  const y60 = pitchToY(60, v) + 5;
  it('finds the body, and the end handle on the right edge', () => {
    assert.deepEqual(hitTest(notes, stepToX(5, v), y60, v), { id: 1, zone: 'body' });
    assert.deepEqual(hitTest(notes, stepToX(8, v) - 2, y60, v), { id: 1, zone: 'end' });
    assert.deepEqual(hitTest(notes, stepToX(4, v) + 2, y60, v), { id: 1, zone: 'start' });
  });
  it('the note drawn on top wins where two overlap', () => {
    const stacked = [note(1, 4, 4, 60), note(2, 6, 2, 60)];
    assert.equal(hitTest(stacked, stepToX(7, v), y60, v)?.id, 2);
    assert.equal(hitTest(stacked, stepToX(5, v), y60, v)?.id, 1);
  });
  it('a tiny note stays movable: no start handle, and its end handle is a third of its width', () => {
    const tiny = hitTest(notes, stepToX(0, v) + 1, pitchToY(64, v) + 3, v);
    assert.equal(tiny?.id, 3);
    assert.equal(tiny?.zone, 'body');
  });
  it('misses empty space, other rows and notes scrolled away', () => {
    assert.equal(hitTest(notes, stepToX(5, v), pitchToY(62, v) + 3, v), null);
    assert.equal(hitTest(notes, 900, y60, v), null);
    assert.equal(hitTest(notes, stepToX(5, v), y60, view({ scrollX: 500 })), null);
  });
});

describe('rubber band', () => {
  it('selects the notes it touches, whichever way it was dragged', () => {
    const v = view();
    const notes = [note(1, 0, 2, 60), note(2, 10, 2, 60), note(3, 0, 2, 70)];
    const r = { x1: stepToX(1, v), y1: pitchToY(60, v) - 2, x2: stepToX(0, v), y2: pitchToY(60, v) + 20 };
    assert.deepEqual(notesInRect(notes, r, v), [1]);
    assert.deepEqual(notesInRect(notes, { x1: -10, y1: -10, x2: 9999, y2: 9999 }, v).sort(), [1, 2, 3]);
    assert.deepEqual(notesInRect(notes, { x1: 5000, y1: 0, x2: 5100, y2: 10 }, v), []);
  });
});

describe('scroll and zoom', () => {
  it('limits scrolling to the pattern and the keyboard', () => {
    const c = clampScroll(view({ scrollX: 1e6, scrollY: 1e6 }), 400, 200, 32);
    assert.equal(c.scrollX, 32 * 20 - 400);
    assert.equal(c.scrollY, (MAX_NOTE - MIN_NOTE + 1) * 14 - 200);
    assert.equal(clampScroll(view({ scrollX: -50, scrollY: -50 }), 400, 200, 32).scrollX, 0);
    assert.equal(clampScroll(view({ scrollX: 100 }), 4000, 200, 8).scrollX, 0, 'a short pattern never scrolls');
  });
  it('zooming keeps the step under the pointer in place', () => {
    const v = view({ scrollX: 120 });
    const anchorX = 180;
    const before = xToStep(anchorX, v);
    const z = zoomX(v, 1.5, anchorX, 600, 64);
    assert.ok(z.stepW > v.stepW);
    assert.ok(Math.abs(xToStep(anchorX, z) - before) < 1e-6);
    const zy = zoomY(view({ scrollY: 300 }), 0.7, 100, 300);
    assert.ok(zy.rowH < 14);
  });
  it('zoom stops at its limits', () => {
    assert.equal(zoomX(view(), 100, 0, 600, 64).stepW, ROLL_MAX_STEP_W);
    assert.equal(zoomX(view(), 0.001, 0, 600, 64).stepW, ROLL_MIN_STEP_W);
  });
  it('centres on a pitch', () => {
    const v = centerOnPitch(view(), 60, 280);
    const mid = pitchToY(60, v) + v.rowH / 2;
    assert.ok(Math.abs(mid - 140) < 1);
  });
});

describe('helpers', () => {
  it('suggests a span around the notes, with a default for an empty roll', () => {
    assert.deepEqual(pitchSpan([]), { low: 48, high: 84 });
    assert.deepEqual(pitchSpan([note(1, 0, 1, 60), note(2, 0, 1, 70)]), { low: 56, high: 74 });
    assert.equal(pitchSpan([note(1, 0, 1, MAX_NOTE)]).high, MAX_NOTE);
  });
  it('formats positions as bar.beat.step, 1-based', () => {
    assert.equal(formatPosition(0), '1.1.1');
    assert.equal(formatPosition(5), '1.2.2');
    assert.equal(formatPosition(16), '2.1.1');
    assert.equal(formatPosition(-3), '1.1.1');
  });
});
