import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Adsr, Biquad, expEnvelope, goertzel, hermite, mulberry32, oscSample, panGains, peak, polyBlep, rms, softClip } from '../src/index';
import { SR, sine } from './synth';

/** Gain in dB of a filter at a frequency, measured on the settled part of a real run. */
function gainDb(make: () => Biquad, freq: number): number {
  const x = sine(freq, 0.5);
  const f = make();
  const y = x.map((s) => f.process(s));
  const a = Math.floor(SR * 0.25);
  return 20 * Math.log10(rms(y, a) / rms(x, a));
}

describe('softClip', () => {
  it('leaves quiet signals untouched', () => {
    for (const x of [0, 0.1, -0.3, 0.6, -0.6]) assert.equal(softClip(x), x);
  });
  it('never exceeds the ceiling, however hot the input', () => {
    for (const x of [0.7, 1, 2, 10, 1e6, -1e6, -3]) assert.ok(Math.abs(softClip(x)) <= 0.98, `softClip(${x})`);
  });
  it('is monotonic, odd, and continuous at the knee', () => {
    let prev = -1;
    for (let x = -4; x <= 4; x += 0.01) {
      const y = softClip(x);
      assert.ok(y >= prev - 1e-12, `not monotonic at ${x}`);
      prev = y;
      assert.ok(Math.abs(softClip(-x) + y) < 1e-12);
    }
    assert.ok(Math.abs(softClip(0.6 + 1e-9) - softClip(0.6)) < 1e-8);
  });
});

describe('panGains', () => {
  it('is equal-power everywhere and hard at the ends', () => {
    for (let p = -1; p <= 1; p += 0.05) {
      const [l, r] = panGains(p);
      assert.ok(Math.abs(l * l + r * r - 1) < 1e-12, `power at ${p}`);
    }
    assert.deepEqual(panGains(-1).map((x) => Math.round(x * 1e9) / 1e9), [1, 0]);
    assert.deepEqual(panGains(1).map((x) => Math.round(x * 1e9) / 1e9), [0, 1]);
    const [cl, cr] = panGains(0);
    assert.ok(Math.abs(cl - cr) < 1e-12);
  });
  it('clamps out-of-range pan', () => {
    assert.deepEqual(panGains(5), panGains(1));
  });
});

describe('Biquad', () => {
  it('lowpass passes lows and cuts highs by 30 dB or more', () => {
    const make = () => new Biquad('lowpass', SR, 1000);
    assert.ok(Math.abs(gainDb(make, 100)) < 0.5);
    assert.ok(gainDb(make, 10000) < -30);
  });
  it('highpass is the mirror', () => {
    const make = () => new Biquad('highpass', SR, 1000);
    assert.ok(gainDb(make, 100) < -30);
    assert.ok(Math.abs(gainDb(make, 10000)) < 0.5);
  });
  it('bandpass peaks at its centre', () => {
    const make = () => new Biquad('bandpass', SR, 2000, 4);
    assert.ok(gainDb(make, 2000) > gainDb(make, 500) + 15);
    assert.ok(gainDb(make, 2000) > gainDb(make, 8000) + 15);
  });
  it('peaking boosts the centre by the requested gain', () => {
    const g = gainDb(() => new Biquad('peaking', SR, 1000, 1, 6), 1000);
    assert.ok(Math.abs(g - 6) < 0.3, `peaking gave ${g.toFixed(2)} dB`);
  });
  it('shelves reach their gain', () => {
    assert.ok(Math.abs(gainDb(() => new Biquad('lowshelf', SR, 500, 0.7, 6), 50) - 6) < 0.5);
    assert.ok(Math.abs(gainDb(() => new Biquad('highshelf', SR, 4000, 0.7, -6), 15000) + 6) < 0.5);
  });
  it('stays stable and finite at extreme settings', () => {
    const f = new Biquad('lowpass', SR, 20, 20);
    let m = 0;
    for (let i = 0; i < SR; i++) m = Math.max(m, Math.abs(f.process(i === 0 ? 1 : 0)));
    assert.ok(Number.isFinite(m) && m < 100);
    f.tune(1e9, 1e-6);
    assert.ok(Number.isFinite(f.process(1)));
  });
});

describe('oscillators', () => {
  it('PolyBLEP saw puts far less energy on an aliased harmonic than a naive saw', () => {
    // 5 kHz saw at 44.1 kHz: the 5th harmonic (25 kHz) folds back to 19.1 kHz.
    const f = 5000;
    const n = SR;
    const naive = new Float32Array(n);
    const blep = new Float32Array(n);
    let ph = 0;
    const dt = f / SR;
    for (let i = 0; i < n; i++) {
      naive[i] = 2 * ph - 1;
      blep[i] = oscSample('saw', ph, dt);
      ph += dt;
      if (ph >= 1) ph -= 1;
    }
    const alias = SR - 5 * f;
    const eN = goertzel(naive, alias, SR);
    const eB = goertzel(blep, alias, SR);
    assert.ok(eB < eN * 0.35, `blep ${eB.toExponential(2)} vs naive ${eN.toExponential(2)}`);
    // and the fundamental survives
    assert.ok(goertzel(blep, f, SR) > goertzel(naive, f, SR) * 0.8);
  });
  it('every waveform stays bounded and has no DC', () => {
    for (const w of ['sine', 'saw', 'square', 'triangle'] as const) {
      let ph = 0;
      let sum = 0;
      let mx = 0;
      const dt = 440 / SR;
      const n = SR;
      for (let i = 0; i < n; i++) {
        const s = oscSample(w, ph, dt);
        sum += s;
        mx = Math.max(mx, Math.abs(s));
        ph += dt;
        if (ph >= 1) ph -= 1;
      }
      assert.ok(mx < 1.2, `${w} peak ${mx}`);
      assert.ok(Math.abs(sum / n) < 0.02, `${w} dc ${sum / n}`);
    }
  });
  it('polyBlep is zero away from the discontinuity', () => {
    assert.equal(polyBlep(0.5, 0.01), 0);
  });
});

describe('hermite', () => {
  it('hits its nodes and reproduces straight lines exactly', () => {
    assert.equal(hermite(1, 2, 3, 4, 0), 2);
    assert.equal(hermite(1, 2, 3, 4, 1), 3);
    for (let f = 0; f <= 1; f += 0.125) assert.ok(Math.abs(hermite(1, 2, 3, 4, f) - (2 + f)) < 1e-12);
  });
});

describe('Adsr', () => {
  it('attacks in the requested time, holds sustain, and releases to done', () => {
    const e = new Adsr(1000);
    e.set(0.1, 0.05, 0.5, 0.1);
    e.gate(true);
    let attackEnd = -1;
    for (let i = 0; i < 2000; i++) {
      e.next();
      if (attackEnd < 0 && e.stage !== 'attack') attackEnd = i;
    }
    assert.ok(Math.abs(attackEnd - 100) <= 2, `attack ended at ${attackEnd}`);
    assert.ok(Math.abs(e.value - 0.5) < 1e-3);
    e.gate(false);
    let prev = e.value;
    let n = 0;
    while (!e.done && n++ < 5000) {
      const v = e.next();
      assert.ok(v <= prev);
      prev = v;
    }
    assert.ok(e.done && e.value === 0);
  });
  it('a retrigger continues from the current level, so it cannot click', () => {
    const e = new Adsr(1000);
    e.set(0.05, 0.2, 0, 0.1);
    e.gate(true);
    for (let i = 0; i < 200; i++) e.next();
    const before = e.value;
    e.gate(true);
    assert.ok(Math.abs(e.next() - before) < 0.05);
  });
});

describe('helpers', () => {
  it('expEnvelope is geometric between points and holds the ends', () => {
    const f = expEnvelope([[0, 1], [1, 0.01]]);
    assert.equal(f(-1), 1);
    assert.ok(Math.abs(f(0.5) - 0.1) < 1e-12);
    assert.equal(f(5), 0.01);
  });
  it('mulberry32 is deterministic, uniform-ish and seed-sensitive', () => {
    const a = mulberry32(3);
    const b = mulberry32(3);
    let sum = 0;
    for (let i = 0; i < 10000; i++) {
      const x = a();
      assert.equal(x, b());
      assert.ok(x >= 0 && x < 1);
      sum += x;
    }
    assert.ok(Math.abs(sum / 10000 - 0.5) < 0.02);
    assert.notEqual(mulberry32(1)(), mulberry32(2)());
  });
  it('goertzel measures a known tone', () => {
    // amplitude 0.5 at an exact bin: power (A/2)^2
    assert.ok(Math.abs(goertzel(sine(441, 1, SR, 0.5), 441, SR) - 0.0625) < 0.004);
    assert.ok(goertzel(sine(441, 1, SR, 0.5), 3000, SR) < 1e-6);
    assert.equal(peak(sine(100, 0.1, SR, 0.7)) > 0.69, true);
  });
});
