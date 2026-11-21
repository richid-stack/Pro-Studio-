import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DRUM_NAMES, DRUM_VARIANTS, drumBuffer, goertzel, peak, renderDrum, rms } from '../src/index';

const RATES = [44100, 48000];

describe('drum synthesis', () => {
  for (const sr of RATES) {
    for (const name of DRUM_NAMES) {
      it(`${name} at ${sr} Hz is finite, audible, normalised and ends silent`, () => {
        for (let v = 0; v < DRUM_VARIANTS[name]; v++) {
          const b = drumBuffer(name, v, sr);
          assert.ok(b.every(Number.isFinite), `${name}/${v} has non-finite samples`);
          const p = peak(b);
          assert.ok(p > 0.89 && p < 0.96, `${name}/${v} peak ${p}`);
          assert.ok(Math.abs(b[b.length - 1] as number) < 1e-3, `${name}/${v} does not end at zero`);
          // decays: the last fifth is far quieter than the first fifth
          const f = Math.floor(b.length / 5);
          assert.ok(rms(b, b.length - f) < rms(b, 0, f) * 0.1, `${name}/${v} does not decay`);
        }
      });
    }
  }

  it('rendering is deterministic', () => {
    for (const name of DRUM_NAMES) assert.deepEqual(renderDrum(name, 1 % DRUM_VARIANTS[name], 44100), renderDrum(name, 1 % DRUM_VARIANTS[name], 44100));
  });

  it('round-robin variants differ (so repeated hats do not machine-gun) but stay in character', () => {
    for (const name of ['snare', 'clap', 'hat', 'ohat', 'rim'] as const) {
      const a = drumBuffer(name, 0, 44100);
      const b = drumBuffer(name, 1, 44100);
      let diff = 0;
      for (let i = 0; i < Math.min(a.length, b.length); i++) diff = Math.max(diff, Math.abs((a[i] as number) - (b[i] as number)));
      assert.ok(diff > 0.02, `${name} variants identical`);
      assert.ok(Math.abs(rms(a) / rms(b) - 1) < 0.5, `${name} variants differ too much in level`);
    }
    assert.equal(drumBuffer('kick', 0, 44100), drumBuffer('kick', 5, 44100), 'kick has one variant');
  });

  it('kick is a low thump: sub energy dwarfs the top end', () => {
    const k = drumBuffer('kick', 0, 44100);
    const low = goertzel(k, 55, 44100, 0, 44100 / 2) + goertzel(k, 80, 44100, 0, 44100 / 2);
    const high = goertzel(k, 4000, 44100) + goertzel(k, 8000, 44100);
    assert.ok(low > high * 100, `low ${low.toExponential(2)} high ${high.toExponential(2)}`);
  });

  it('hats are bright, snares and claps are mid-band, rim is ringing', () => {
    const sr = 44100;
    const hat = drumBuffer('hat', 0, sr);
    assert.ok(goertzel(hat, 9000, sr) + goertzel(hat, 11000, sr) > (goertzel(hat, 200, sr) + goertzel(hat, 400, sr)) * 50);
    const snare = drumBuffer('snare', 0, sr);
    assert.ok(goertzel(snare, 4000, sr) + goertzel(snare, 180, sr) > goertzel(snare, 15000, sr) * 5);
    const rim = drumBuffer('rim', 0, sr);
    assert.ok(goertzel(rim, 1700, sr, 0, 2000) + goertzel(rim, 2550, sr, 0, 2000) > goertzel(rim, 6000, sr, 0, 2000));
  });

  it('open hat rings long, closed hat is short', () => {
    const sr = 44100;
    // the closed hat buffer is only 0.25 s long, so compare inside it
    const tail = (b: Float32Array) => rms(b, Math.floor(0.15 * sr), Math.floor(0.23 * sr));
    assert.ok(tail(drumBuffer('ohat', 0, sr)) > tail(drumBuffer('hat', 0, sr)) * 20);
  });

  it('every hit has its transient within 5 ms (the sequencer owns timing, the sound must not add lag)', () => {
    for (const name of DRUM_NAMES) {
      const sr = 44100;
      const b = drumBuffer(name, 0, sr);
      const p = peak(b);
      const first = b.findIndex((x) => Math.abs(x) > p * 0.3);
      assert.ok(first >= 0 && first < 0.005 * sr, `${name} first loud sample at ${((first / sr) * 1000).toFixed(1)} ms`);
    }
  });
});
