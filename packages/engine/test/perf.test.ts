import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Engine, type TimedEvent } from '../src/index';

/**
 * Not a benchmark, a tripwire: a heavy scene must render much faster than real time on a slow CI machine.
 * The real-device number (a phone, 128-frame blocks) is measured by the owner; see docs/TESTING.md.
 */
describe('performance', () => {
  it('renders 64 voices with reverb and delay at least 3x faster than real time', () => {
    const SR = 48000;
    const e = new Engine(SR);
    const events: TimedEvent[] = [];
    for (let c = 0; c < 8; c++) {
      e.addChannel({ id: `p${c}`, kind: 'poly', preset: (['keys', 'pluck', 'pad', 'organ'] as const)[c % 4] as 'keys', maxVoices: 8 }, { rev: 0.3, dly: 0.2, pan: (c - 4) / 4 });
      for (let n = 0; n < 8; n++) events.push({ offset: 0, event: { type: 'noteOn', channel: `p${c}`, note: 36 + c * 4 + n * 3, velocity: 0.8 } });
    }
    e.addChannel({ id: 'k', kind: 'drum', drum: 'kick' });
    e.addChannel({ id: 'b', kind: 'bass808' });
    events.push({ offset: 0, event: { type: 'noteOn', channel: 'b', note: 36, velocity: 1 } });
    const seconds = 4;
    const block = 128;
    const l = new Float32Array(block);
    const r = new Float32Array(block);
    // warm up the JIT, then time
    for (let i = 0; i < 200; i++) e.process(l, r, block, i === 0 ? events : []);
    const blocks = Math.floor((seconds * SR) / block);
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < blocks; i++) e.process(l, r, block, i % 375 === 0 ? [{ offset: 0, event: { type: 'noteOn', channel: 'k', note: 60, velocity: 1 } }] : []);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const factor = (seconds * 1000) / ms;
    console.log(`perf: ${seconds} s of audio with ${e.voiceCount} voices in ${ms.toFixed(0)} ms = ${factor.toFixed(1)}x real time (${((ms / blocks) * 1000).toFixed(0)} µs per 128-frame block; the budget is ${((block / SR) * 1e6).toFixed(0)} µs)`);
    assert.ok(e.voiceCount >= 40, `only ${e.voiceCount} voices were active`);
    assert.ok(factor > 3, `only ${factor.toFixed(1)}x real time`);
    assert.equal(e.nonFiniteSamples, 0);
  });
});
