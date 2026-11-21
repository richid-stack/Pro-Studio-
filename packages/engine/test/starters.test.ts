import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createStarterProject, PPQ, STEPS_PER_BAR, type Genre } from '@pro-studio/shared';
import { goertzel, peak, renderOffline, rms } from '../src/index';

const SR = 44100;

describe('starter projects render to a usable beat', () => {
  for (const genre of ['trap', 'drill', 'rnb', 'afro'] as Genre[]) {
    it(`${genre}: loud enough, not clipping, finite, with sub and top end`, () => {
      const p = createStarterProject(genre);
      const loopSeconds = ((p.bars * 4 * 60) / p.bpm);
      const { left, right, host } = renderOffline({ seconds: loopSeconds * 2, commands: [{ type: 'setProject', project: p }, { type: 'play' }] });
      assert.ok(left.every(Number.isFinite) && right.every(Number.isFinite));
      assert.equal(host.engine.nonFiniteSamples, 0);
      const pk = Math.max(peak(left), peak(right));
      assert.ok(pk > 0.4 && pk <= 0.98 + 1e-6, `${genre} peak ${pk.toFixed(3)}`);
      // a healthy rough mix sits around -20 to -8 dBFS RMS
      const db = 20 * Math.log10((rms(left) + rms(right)) / 2);
      assert.ok(db > -26 && db < -8, `${genre} RMS ${db.toFixed(1)} dBFS`);
      // soft-clip engaged on very few samples: the mix has headroom
      let hot = 0;
      for (const x of left) if (Math.abs(x) > 0.9) hot++;
      assert.ok(hot / left.length < 0.01, `${genre}: ${((hot / left.length) * 100).toFixed(2)}% of samples above 0.9`);
      const bands = (hz: number[]) => hz.reduce((s, f) => s + goertzel(left, f, SR), 0);
      assert.ok(bands([41, 49, 55, 62]) > 0, 'no sub energy');
      assert.ok(bands([6000, 9000, 12000]) > 0, 'no top end');
    });

    it(`${genre}: the loop repeats: the second pass has the same loudness shape as the first`, () => {
      const p = createStarterProject(genre);
      const loop = Math.round(((p.bars * 4 * 60) / p.bpm) * SR);
      const { left } = renderOffline({ seconds: (loop * 3) / SR, commands: [{ type: 'setProject', project: p }, { type: 'play' }] });
      const win = Math.floor(loop / 8);
      for (let i = 0; i < 8; i++) {
        const a = rms(left, loop + i * win, loop + (i + 1) * win);
        const b = rms(left, 2 * loop + i * win, 2 * loop + (i + 1) * win);
        assert.ok(Math.abs(a - b) <= 0.02 + 0.12 * Math.max(a, b), `${genre} window ${i}: ${a.toFixed(4)} vs ${b.toFixed(4)}`);
      }
    });
  }

  it('a muted or soloed starter channel really changes the render', () => {
    const p = createStarterProject('trap');
    const full = renderOffline({ seconds: 2, commands: [{ type: 'setProject', project: p }, { type: 'play' }] }).left;
    const noBass = renderOffline({ seconds: 2, commands: [{ type: 'setProject', project: { ...p, channels: p.channels.map((c) => (c.id === 'bass' ? { ...c, mix: { ...c.mix, mute: true } } : c)) } }, { type: 'play' }] }).left;
    const sub = (x: Float32Array) => goertzel(x, 65.41, SR) + goertzel(x, 77.78, SR) + goertzel(x, 87.31, SR) + goertzel(x, 103.83, SR);
    assert.ok(sub(noBass) < sub(full) * 0.5, `sub ${sub(noBass)} vs ${sub(full)}`);
    assert.ok(PPQ > 0 && STEPS_PER_BAR === 16);
  });
});
