import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createStarterProject } from '@pro-studio/shared';
import { loopFramesOf, renderLoopWithTail, renderOffline, renderSeamlessLoop, rms } from '../src/index';

const SR = 22050; // a lower rate keeps the test fast; the logic does not depend on it
const project = () => createStarterProject('trap');

describe('loop length', () => {
  it('is bars x 16 steps at the tempo, in frames', () => {
    const p = { ...project(), bars: 2, bpm: 120 };
    assert.equal(loopFramesOf(p, 44100), 4 * 44100); // 2 bars of 4/4 at 120 bpm = 4 seconds
    assert.equal(loopFramesOf({ ...p, bars: 1 }, 44100), 2 * 44100);
  });
});

describe('bounce with a tail', () => {
  const p = { ...project(), channels: project().channels.map((c) => ({ ...c, mix: { ...c.mix, rev: 0.5, dly: 0.3 } })) };
  const r = renderLoopWithTail(p, { sampleRate: SR, tailSeconds: 2 });

  it('is the loop followed by the tail', () => {
    assert.equal(r.left.length, r.loopFrames + 2 * SR);
    assert.equal(r.right.length, r.left.length);
  });

  it('the loop part is exactly what a plain render produces', () => {
    const plain = renderOffline({ sampleRate: SR, seconds: r.loopFrames / SR, commands: [{ type: 'setProject', project: p }, { type: 'play' }] });
    for (let i = 0; i < r.loopFrames; i += 997) assert.equal(r.left[i], plain.left[i]);
  });

  it('plays nothing new in the tail: it rings and dies away', () => {
    const early = rms(r.left, r.loopFrames, r.loopFrames + SR / 2);
    const late = rms(r.left, r.loopFrames + 1.5 * SR, r.loopFrames + 2 * SR);
    assert.ok(early > 0, 'the tail is not silent right away');
    assert.ok(late < early, `tail should decay (early ${early}, late ${late})`);
    // a second pass of the pattern would put a kick in the first tenth of a second: the tail must not have one
    const firstTenth = rms(r.left, r.loopFrames, r.loopFrames + SR / 10);
    const loopStart = rms(r.left, 0, SR / 10);
    assert.ok(firstTenth < loopStart * 0.8, `tail start ${firstTenth} vs loop start ${loopStart}`);
  });

  it('stays finite and under the master ceiling', () => {
    for (let i = 0; i < r.left.length; i += 313) assert.ok(Math.abs(r.left[i] as number) <= 0.98 + 1e-6);
  });
});

describe('seamless loop', () => {
  // Only channels that repeat sample for sample: round-robin drums and the free-running 808 phase are meant to
  // vary from pass to pass, so they would hide what this test is about, the tails wrapping around the seam.
  const p = {
    ...project(),
    channels: project().channels.filter((c) => c.id === 'kick' || c.id === 'keys').map((c) => ({ ...c, mix: { ...c.mix, rev: 0.5, dly: 0.3 } })),
  };
  const r = renderSeamlessLoop(p, { sampleRate: SR });

  it('is exactly one loop long', () => {
    assert.equal(r.left.length, r.loopFrames);
  });

  it('already contains the previous pass ringing in, so it is the steady state', () => {
    // three passes rendered the long way: the second and third are the same audio if the loop is seamless
    const three = renderOffline({ sampleRate: SR, seconds: (3 * r.loopFrames) / SR, commands: [{ type: 'setProject', project: p }, { type: 'play' }] });
    const L = r.loopFrames;
    let diff = 0;
    let energy = 0;
    for (let i = 0; i < L; i++) {
      const a = three.left[L + i] as number;
      const b = three.left[2 * L + i] as number;
      diff += (a - b) ** 2;
      energy += a * a;
    }
    assert.ok(diff / energy < 0.01, `pass 2 and 3 differ by ${((diff / energy) * 100).toFixed(2)} % of the energy`);
    // and the exported loop is that second pass
    for (let i = 0; i < L; i += 991) assert.equal(r.left[i], three.left[L + i]);
  });

  it('differs from a first pass at the start, which has no earlier tail to ring in', () => {
    const first = renderOffline({ sampleRate: SR, seconds: r.loopFrames / SR, commands: [{ type: 'setProject', project: p }, { type: 'play' }] });
    let moved = 0;
    for (let i = 0; i < SR / 4; i++) moved += Math.abs((r.left[i] as number) - (first.left[i] as number));
    assert.ok(moved > 0.01);
  });
});
