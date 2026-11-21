import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyGesture, beginDraw, beginMove, beginResize, beginVelocity, createStarterProject, findChannel,
  type InstrumentChannel, type Project,
} from '../src/index';

const notesOf = (p: Project, id = 'keys') => (findChannel(p, id) as InstrumentChannel).notes;

describe('drawing a note', () => {
  it('snaps the start down to the grid line and starts one cell long', () => {
    const { project, gesture } = beginDraw(createStarterProject('trap'), 'keys', { step: 5.7, pitch: 60 }, 1);
    const n = notesOf(project).find((x) => x.id === (gesture as { noteId: number }).noteId);
    assert.deepEqual([n?.t, n?.d, n?.n], [5, 1, 60]);
  });

  it('dragging right sets the length from the snapped end, and is repeatable from the same base', () => {
    const { project, gesture } = beginDraw(createStarterProject('trap'), 'keys', { step: 4, pitch: 64 }, 1);
    const id = (gesture as { noteId: number }).noteId;
    const a = applyGesture(project, gesture, { step: 8.4, pitch: 64 });
    const b = applyGesture(project, gesture, { step: 8.4, pitch: 64 });
    assert.equal(notesOf(a).find((n) => n.id === id)?.d, 4);
    assert.deepEqual(a, b);
    // dragging back never goes shorter than one cell
    assert.equal(notesOf(applyGesture(project, gesture, { step: 2, pitch: 64 })).find((n) => n.id === id)?.d, 1);
  });

  it('with snapping off the length follows the pointer and a tap makes a 64th', () => {
    const { project, gesture } = beginDraw(createStarterProject('trap'), 'keys', { step: 4.3, pitch: 64 }, 0);
    const id = (gesture as { noteId: number }).noteId;
    assert.equal(notesOf(project).find((n) => n.id === id)?.t, 4.3);
    assert.equal(notesOf(project).find((n) => n.id === id)?.d, 0.25);
    assert.ok(Math.abs((notesOf(applyGesture(project, gesture, { step: 6.8, pitch: 64 })).find((n) => n.id === id)?.d ?? 0) - 2.5) < 1e-9);
  });

  it('does nothing on a drum channel', () => {
    const p = createStarterProject('trap');
    assert.equal(beginDraw(p, 'kick', { step: 1, pitch: 60 }, 1).project, p);
  });
});

describe('moving and resizing', () => {
  const p = createStarterProject('trap');
  const first = notesOf(p)[0];
  assert.ok(first);
  const ids = new Set([first.id]);

  it('moves by whole grid cells and whole semitones, relative to where the drag began', () => {
    const g = beginMove(ids, 'keys', { step: first.t + 0.2, pitch: first.n }, 1);
    const moved = applyGesture(p, g, { step: first.t + 2.6, pitch: first.n + 3 });
    const n = notesOf(moved).find((x) => x.id === first.id);
    assert.equal(n?.t, first.t + 2); // the pointer travelled 2.4 steps: nearest grid cell is 2
    assert.equal(n?.n, first.n + 3);
    // the same pointer position from the same base always gives the same project
    assert.deepEqual(moved, applyGesture(p, g, { step: first.t + 2.6, pitch: first.n + 3 }));
  });

  it('returns to the original when the pointer returns to where it began', () => {
    const g = beginMove(ids, 'keys', { step: 10, pitch: 60 }, 1);
    const there = applyGesture(p, g, { step: 14, pitch: 65 });
    assert.notDeepEqual(there, p);
    assert.deepEqual(applyGesture(p, g, { step: 10, pitch: 60 }), p);
  });

  it('resizes the end by snapped distance', () => {
    const g = beginResize(ids, 'keys', { step: first.t + first.d, pitch: first.n }, 1);
    const longer = applyGesture(p, g, { step: first.t + first.d + 2.4, pitch: first.n });
    assert.equal(notesOf(longer).find((x) => x.id === first.id)?.d, first.d + 2);
  });
});

describe('velocity', () => {
  it('sets every note in the set and clamps', () => {
    const p = createStarterProject('trap');
    const ids = new Set(notesOf(p).slice(0, 2).map((n) => n.id));
    const g = beginVelocity(ids, 'keys');
    const next = applyGesture(p, g, { step: 0, pitch: 0 }, 0.4);
    for (const n of notesOf(next)) if (ids.has(n.id)) assert.equal(n.v, 0.4);
    for (const n of notesOf(applyGesture(p, g, { step: 0, pitch: 0 }, 7))) if (ids.has(n.id)) assert.equal(n.v, 1);
  });
});
