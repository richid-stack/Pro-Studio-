import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addDrumChannel, addInstrumentChannel, addNote, addNotes, clearChannel, createStarterProject, deleteNotes, duplicateNotes,
  findChannel, moveChannel, moveNotes, quantizeNotes, removeChannel, renameChannel, resizeNotes, setBars, setBpm, setMix,
  setKey, setScale, setNoteSlide, setNoteVelocity, setRatchet, setStepVelocity, setSwing, toggleStep, totalSteps, MAX_NOTE, MIN_NOTE,
  type DrumChannel, type InstrumentChannel, type Project,
} from '../src/index';

const base = (): Project => createStarterProject('trap');
const drumOf = (p: Project, id: string) => findChannel(p, id) as DrumChannel;
const instOf = (p: Project, id: string) => findChannel(p, id) as InstrumentChannel;

describe('edits never mutate their input', () => {
  it('returns a new project and leaves the old one untouched', () => {
    const p = base();
    const snapshot = JSON.stringify(p);
    const steps = [
      toggleStep(p, 'kick', 3), setStepVelocity(p, 'kick', 0, 0.3), setRatchet(p, 'hat', 5, 4), setBpm(p, 100), setSwing(p, 0.5),
      setMix(p, 'kick', { db: -20 }), renameChannel(p, 'kick', 'Boom'), setBars(p, 4), clearChannel(p, 'bass'),
      addNote(p, 'keys', { t: 1, d: 2, n: 60, v: 0.8, s: false }).project, removeChannel(p, 'hat'), moveChannel(p, 'hat', 0),
    ];
    assert.equal(JSON.stringify(p), snapshot);
    for (const s of steps) assert.notEqual(s, p);
  });

  it('a no-op returns the very same object, so history can skip it', () => {
    const p = base();
    assert.equal(toggleStep(p, 'kick', 999), p);
    assert.equal(toggleStep(p, 'nope', 0), p);
    assert.equal(toggleStep(p, 'bass', 0), p, 'bass is not a drum channel');
    assert.equal(setBars(p, p.bars), p);
    assert.equal(removeChannel(p, 'nope'), p);
    assert.equal(renameChannel(p, 'kick', '   '), p);
    assert.equal(deleteNotes(p, 'keys', new Set([99999])), p);
  });
});

describe('step grid', () => {
  it('toggles on at the given velocity and off again, clearing the ratchet', () => {
    let p = toggleStep(base(), 'clap', 3, 0.6);
    assert.equal(drumOf(p, 'clap').v[3], 0.6);
    p = setRatchet(p, 'clap', 3, 3);
    assert.equal(drumOf(p, 'clap').r[3], 3);
    p = toggleStep(p, 'clap', 3);
    assert.equal(drumOf(p, 'clap').v[3], 0);
    assert.equal(drumOf(p, 'clap').r[3], 1);
  });

  it('clamps velocity and ratchet, and a ratchet on an empty step turns it on', () => {
    let p = toggleStep(base(), 'ohat', 2, 9);
    assert.equal(drumOf(p, 'ohat').v[2], 1);
    p = setStepVelocity(p, 'ohat', 2, 0);
    assert.equal(drumOf(p, 'ohat').v[2], 0);
    p = setRatchet(p, 'ohat', 2, 99);
    assert.equal(drumOf(p, 'ohat').r[2], 8);
    assert.ok((drumOf(p, 'ohat').v[2] ?? 0) > 0);
    assert.equal(drumOf(setRatchet(p, 'ohat', 2, -4), 'ohat').r[2], 1);
  });

  it('clearChannel empties drums and notes alike', () => {
    const p = clearChannel(clearChannel(base(), 'kick'), 'keys');
    assert.ok(drumOf(p, 'kick').v.every((x) => x === 0));
    assert.equal(instOf(p, 'keys').notes.length, 0);
  });
});

describe('notes', () => {
  const withNote = () => addNote(base(), 'bass', { t: 4, d: 2, n: 40, v: 0.8, s: false });

  it('adds with fresh ids, clamping into the pattern and the pitch range', () => {
    const a = addNote(base(), 'keys', { t: 0, d: 1, n: 60, v: 1, s: false });
    const b = addNote(a.project, 'keys', { t: -5, d: 100, n: 200, v: 4, s: false });
    assert.notEqual(a.id, b.id);
    const n = instOf(b.project, 'keys').notes.find((x) => x.id === b.id);
    assert.deepEqual(n && [n.t, n.n, n.v], [0, MAX_NOTE, 1]);
    assert.ok(n && n.d <= totalSteps(b.project));
    assert.equal(addNote(base(), 'kick', { t: 0, d: 1, n: 60, v: 1, s: false }).id, -1);
  });

  it('moves a group together and keeps its shape at the edges', () => {
    let p = base();
    const chord = addNotes(p, 'keys', [{ t: 2, d: 2, n: 60, v: 1, s: false }, { t: 2, d: 2, n: 64, v: 1, s: false }, { t: 2, d: 2, n: 67, v: 1, s: false }]);
    p = chord.project;
    const ids = new Set(chord.ids);
    const moved = moveNotes(p, 'keys', ids, -50, 500);
    const ns = instOf(moved, 'keys').notes.filter((n) => ids.has(n.id));
    assert.deepEqual(ns.map((n) => n.t), [0, 0, 0]);
    assert.deepEqual(ns.map((n) => n.n - (ns[0]?.n ?? 0)), [0, 4, 7], 'chord shape preserved');
    assert.equal(Math.max(...ns.map((n) => n.n)), MAX_NOTE);
    const down = moveNotes(p, 'keys', ids, 0, -500);
    assert.equal(Math.min(...instOf(down, 'keys').notes.filter((n) => ids.has(n.id)).map((n) => n.n)), MIN_NOTE);
  });

  it('resizes within bounds, and only the selected notes', () => {
    const w = withNote();
    const ids = new Set([w.id]);
    const longer = resizeNotes(w.project, 'bass', ids, 3);
    assert.equal(instOf(longer, 'bass').notes.find((n) => n.id === w.id)?.d, 5);
    assert.equal(instOf(resizeNotes(w.project, 'bass', ids, -50), 'bass').notes.find((n) => n.id === w.id)?.d, 0.25);
    assert.equal(instOf(resizeNotes(w.project, 'bass', ids, 500), 'bass').notes.find((n) => n.id === w.id)?.d, totalSteps(w.project) - 4);
    const others = instOf(longer, 'bass').notes.filter((n) => n.id !== w.id);
    assert.deepEqual(others, instOf(w.project, 'bass').notes.filter((n) => n.id !== w.id));
  });

  it('sets velocity and slide, deletes, and duplicates with new ids', () => {
    const w = withNote();
    const ids = new Set([w.id]);
    assert.equal(instOf(setNoteVelocity(w.project, 'bass', ids, 0.3), 'bass').notes.find((n) => n.id === w.id)?.v, 0.3);
    assert.equal(instOf(setNoteSlide(w.project, 'bass', ids, true), 'bass').notes.find((n) => n.id === w.id)?.s, true);
    const dup = duplicateNotes(w.project, 'bass', ids, 8);
    assert.equal(dup.ids.length, 1);
    assert.ok(!ids.has(dup.ids[0] as number));
    assert.equal(instOf(dup.project, 'bass').notes.find((n) => n.id === dup.ids[0])?.t, 12);
    assert.equal(instOf(deleteNotes(dup.project, 'bass', ids), 'bass').notes.some((n) => n.id === w.id), false);
    assert.equal(duplicateNotes(w.project, 'bass', ids, 1000).ids.length, 0, 'a copy past the end is dropped');
  });

  it('quantizes fully or part of the way', () => {
    const w = addNote(base(), 'bass', { t: 3.4, d: 1, n: 40, v: 1, s: false });
    const ids = new Set([w.id]);
    const at = (p: Project) => instOf(p, 'bass').notes.find((n) => n.id === w.id)?.t;
    assert.equal(at(quantizeNotes(w.project, 'bass', ids, 1)), 3);
    assert.equal(at(quantizeNotes(w.project, 'bass', ids, 4)), 4);
    assert.ok(Math.abs((at(quantizeNotes(w.project, 'bass', ids, 1, 0.5)) ?? 0) - 3.2) < 1e-9);
  });
});

describe('pattern length', () => {
  it('growing repeats drum steps and notes; shrinking drops what no longer fits', () => {
    const p = base();
    const four = setBars(p, 4);
    assert.equal(four.bars, 4);
    const k = drumOf(four, 'kick');
    assert.equal(k.v.length, 64);
    assert.deepEqual(k.v.slice(32, 64), drumOf(p, 'kick').v, 'bars 3-4 repeat bars 1-2');
    assert.equal(instOf(four, 'bass').notes.length, instOf(p, 'bass').notes.length * 2);
    assert.equal(new Set(instOf(four, 'bass').notes.map((n) => n.id)).size, instOf(four, 'bass').notes.length, 'ids stay unique');
    const back = setBars(four, 1);
    assert.equal(drumOf(back, 'kick').v.length, 16);
    assert.ok(instOf(back, 'bass').notes.every((n) => n.t + n.d <= 16));
    assert.equal(setBars(p, 99).bars, 4);
    assert.equal(setBars(p, 0).bars, 1);
  });

  it('a one-bar loop tiles instead of leaving silence', () => {
    const one = setBars(base(), 1);
    const two = setBars(one, 2);
    assert.deepEqual(drumOf(two, 'kick').v.slice(16), drumOf(two, 'kick').v.slice(0, 16));
  });
});

describe('project and channels', () => {
  it('clamps tempo, swing and mixer values', () => {
    assert.equal(setBpm(base(), 9999).bpm, 240);
    assert.equal(setBpm(base(), 1).bpm, 40);
    assert.equal(setSwing(base(), 3).swing, 1);
    const m = findChannel(setMix(base(), 'kick', { db: 99, pan: -9, rev: 2, dly: -1, duck: 7 }), 'kick')?.mix;
    assert.deepEqual(m && [m.db, m.pan, m.rev, m.dly, m.duck], [6, -1, 1, 0, 1]);
  });

  it('adds channels with unique ids, cycling colours, and removes and reorders them', () => {
    let p = base();
    const a = addDrumChannel(p, 'kick');
    p = a.project;
    const b = addDrumChannel(p, 'kick');
    assert.notEqual(a.id, b.id);
    p = b.project;
    const c = addInstrumentChannel(p, 'pad');
    p = c.project;
    assert.equal(drumOf(p, a.id).v.length, totalSteps(p));
    assert.ok(p.channels.every((ch) => /^ch-(1[0-2]|[1-9])$/.test(ch.color)));
    assert.equal(new Set(p.channels.map((ch) => ch.id)).size, p.channels.length);
    const moved = moveChannel(p, c.id, 0);
    assert.equal(moved.channels[0]?.id, c.id);
    assert.equal(removeChannel(moved, c.id).channels.length, p.channels.length - 1);
  });
});

describe('key and scale', () => {
  it('wraps the key into 0..11 and returns the same project when nothing changes', () => {
    const p = base();
    assert.equal(setKey(p, p.key), p);
    assert.equal(setKey(p, 14).key, 2);
    assert.equal(setKey(p, -1).key, 11);
    assert.equal(setScale(p, p.scale), p);
    assert.equal(setScale(p, 'major').scale, 'major');
  });
});
