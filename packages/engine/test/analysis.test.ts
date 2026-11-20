import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectOnsets, detectPitch, evenCuts, findLoop } from '../src/index';
import { SR, drumLoop, noise, tone } from './synth';

test('auto-chop finds every hit in a kick / snare / hat loop, within 10 ms', () => {
  const { audio, hits } = drumLoop();
  for (const sensitivity of [0.2, 0.55, 0.9]) {
    const cuts = detectOnsets(audio, SR, { sensitivity, maxCuts: 16 });
    assert.equal(cuts.length, hits.length, `sensitivity ${sensitivity}: ${cuts.map((c) => c.toFixed(3)).join(' ')}`);
    cuts.forEach((c, i) => assert.ok(Math.abs(c - (hits[i] as number)) < 0.01, `cut ${i} at ${c.toFixed(3)} vs ${hits[i]}`));
  }
});

test('auto-chop never exceeds the pad count', () => {
  const { audio } = drumLoop();
  assert.equal(detectOnsets(audio, SR, { sensitivity: 1, maxCuts: 4 }).length, 4);
});

test('auto-chop on silence returns a single cut at zero', () => {
  assert.deepEqual(detectOnsets(new Float32Array(SR), SR, { sensitivity: 0.5, maxCuts: 16 }), [0]);
});

test('evenCuts splits a clip into equal parts', () => {
  assert.deepEqual(evenCuts(4, 4), [0, 1, 2, 3]);
});

test('pitch: A3 220 Hz is MIDI 57, E2 82.41 Hz is MIDI 40, within 10 cents', () => {
  const a3 = detectPitch(tone(220, 2), SR);
  assert.ok(a3 && a3.confidence > 0.9, 'A3 confident');
  assert.ok(Math.abs(a3.midi - 57) < 0.1, `A3 read as ${a3?.midi}`);
  const e2 = detectPitch(tone(82.41, 2), SR);
  assert.ok(e2 && Math.abs(e2.midi - 40) < 0.1, `E2 read as ${e2?.midi}`);
});

test('pitch: noise and drums have no pitch', () => {
  assert.equal(detectPitch(noise(1), SR), null);
  const { audio } = drumLoop();
  const r = detectPitch(audio, SR);
  assert.ok(r === null || r.confidence < 0.7, 'drum loop must not look pitched');
});

test('pitch: a clip shorter than one analysis window is rejected', () => {
  assert.equal(detectPitch(new Float32Array(1000), SR), null);
});

test('loop: the end of the loop lines up in phase with its start', () => {
  const x = tone(220, 2);
  const loop = findLoop(x, SR);
  assert.ok(loop, 'a loop is found');
  assert.ok(loop.end > loop.start + 0.3, 'loop is at least 300 ms');
  const a = Math.floor(loop.start * SR);
  const b = Math.floor(loop.end * SR);
  const rms = (at: number) => Math.sqrt(Array.from({ length: 400 }, (_, i) => (x[at + i] as number) ** 2).reduce((p, c) => p + c, 0) / 400);
  const ra = rms(a);
  const rb = rms(b);
  let err = 0;
  for (let i = 0; i < 400; i++) {
    const d = (x[a + i] as number) / ra - (x[b + i] as number) / rb;
    err += d * d;
  }
  assert.ok(err / 400 < 0.01, `shape mismatch ${(err / 400).toFixed(4)}`);
  assert.ok(rb / ra > 0.5 && rb / ra < 2, `level jump ${(rb / ra).toFixed(2)}x is small enough for a crossfade to hide`);
});

test('loop: clips under 300 ms cannot loop', () => {
  assert.equal(findLoop(tone(220, 0.2), SR), null);
});
