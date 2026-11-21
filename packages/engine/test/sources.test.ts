import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Bass808, goertzel, PolySynth, POLY_PRESETS, rms, peak, Sampler, type PolyPresetName } from '../src/index';
import { SR, runSource, sine, zeroCrossFreq } from './synth';

const maxStep = (x: Float32Array, from: number, to: number): number => {
  let m = 0;
  for (let i = Math.floor(from * SR) + 1; i < Math.floor(to * SR); i++) m = Math.max(m, Math.abs((x[i] as number) - (x[i - 1] as number)));
  return m;
};

describe('Bass808', () => {
  it('plays the right pitch once the thump has settled (A2 = 110 Hz, E1 = 41.2 Hz)', () => {
    for (const [note, hz] of [[45, 110], [28, 41.2034], [57, 220]] as const) {
      const { l } = runSource(new Bass808(SR), 1, [[0, (s) => s.noteOn(note, 1)]]);
      const f = zeroCrossFreq(l, 0.25, 0.7);
      assert.ok(Math.abs(f / hz - 1) < 0.01, `note ${note}: ${f.toFixed(2)} Hz vs ${hz}`);
    }
  });

  it('stays at or under its level and is a clean sine when drive is zero', () => {
    const { l } = runSource(new Bass808(SR, { drive: 0, punch: 0 }), 1, [[0, (s) => s.noteOn(45, 1)]]);
    assert.ok(peak(l) <= 0.9 + 1e-6 && peak(l) > 0.8);
    assert.ok(goertzel(l, 330, SR, 0, SR / 2) < goertzel(l, 110, SR, 0, SR / 2) * 1e-3, 'third harmonic present without drive');
  });

  it('drive adds harmonics so it carries on small speakers', () => {
    const clean = runSource(new Bass808(SR, { drive: 0, punch: 0 }), 0.5, [[0, (s) => s.noteOn(45, 1)]]).l;
    const driven = runSource(new Bass808(SR, { drive: 0.8, punch: 0 }), 0.5, [[0, (s) => s.noteOn(45, 1)]]).l;
    const ratio = (x: Float32Array) => goertzel(x, 330, SR) / goertzel(x, 110, SR);
    assert.ok(ratio(driven) > ratio(clean) * 100);
  });

  it('decay shortens and lengthens the tail', () => {
    const tail = (decay: number) => {
      const { l } = runSource(new Bass808(SR, { decay }), 1.5, [[0, (s) => s.noteOn(40, 1)]]);
      return rms(l, Math.floor(0.9 * SR), Math.floor(1.1 * SR));
    };
    assert.ok(tail(0.4) < tail(1.6) * 0.1);
  });

  it('note-off releases to silence quickly and without a click', () => {
    const { l } = runSource(new Bass808(SR), 1, [[0, (s) => s.noteOn(40, 1)], [0.3, (s) => s.noteOff(40)]]);
    assert.ok(peak(l, Math.floor(0.5 * SR), l.length) < 1e-3);
    assert.ok(maxStep(l, 0.29, 0.45) < 0.05, 'discontinuity at release');
  });

  it('a slide glides in pitch without retriggering (no jump, no new attack)', () => {
    const { l } = runSource(new Bass808(SR, { drive: 0, punch: 0, glide: 0.12 }), 1.2, [[0, (s) => s.noteOn(36, 1)], [0.4, (s) => s.noteOn(43, 1, true)]]);
    const before = zeroCrossFreq(l, 0.3, 0.4);
    const during = zeroCrossFreq(l, 0.41, 0.47);
    const after = zeroCrossFreq(l, 0.9, 1.1);
    assert.ok(Math.abs(before / 65.406 - 1) < 0.02, `before ${before}`);
    assert.ok(during > before * 1.02 && during < after * 0.99, `during ${during} should sit between ${before} and ${after}`);
    assert.ok(Math.abs(after / 97.999 - 1) < 0.02, `after ${after}`);
    assert.ok(maxStep(l, 0.39, 0.5) < 0.05, 'slide clicked');
  });

  it('a retriggered note keeps phase and level, so it does not click', () => {
    const { l } = runSource(new Bass808(SR), 1, [[0, (s) => s.noteOn(36, 1)], [0.3, (s) => s.noteOn(36, 1)]]);
    assert.ok(maxStep(l, 0.29, 0.33) < 0.1, `step ${maxStep(l, 0.29, 0.33)}`);
  });

  it('choke fades out inside 25 ms', () => {
    const { l } = runSource(new Bass808(SR), 0.5, [[0, (s) => s.noteOn(40, 1)], [0.2, (s) => s.choke()]]);
    assert.ok(peak(l, Math.floor(0.225 * SR), l.length) < 1e-3);
  });
});

describe('PolySynth', () => {
  it('plays a chord: each chord tone stands well above the gaps between them', () => {
    const { l } = runSource(new PolySynth(SR, 'organ'), 1, [[0, (s) => { s.noteOn(60, 1); s.noteOn(64, 1); s.noteOn(67, 1); }]]);
    const tone = (hz: number) => goertzel(l, hz, SR, Math.floor(0.2 * SR), Math.floor(0.9 * SR));
    for (const hz of [261.63, 329.63, 392.0]) assert.ok(tone(hz) > tone(hz * 1.09) * 20, `${hz} Hz not prominent`);
    assert.ok(tone(261.63) > tone(300) * 20);
  });

  it('note-off releases to silence', () => {
    const { l } = runSource(new PolySynth(SR, 'organ'), 1, [[0, (s) => s.noteOn(60, 1)], [0.3, (s) => s.noteOff(60)]]);
    assert.ok(peak(l, Math.floor(0.9 * SR), l.length) < 1e-3);
  });

  it('every preset is finite, audible and not hot, even with a six-note chord at full velocity', () => {
    for (const name of Object.keys(POLY_PRESETS) as PolyPresetName[]) {
      const { l } = runSource(new PolySynth(SR, name), 1.5, [[0, (s) => [48, 55, 60, 64, 67, 71].forEach((n) => s.noteOn(n, 1))]]);
      assert.ok(l.every(Number.isFinite), `${name} not finite`);
      assert.ok(peak(l) > 0.1, `${name} too quiet: ${peak(l)}`);
      assert.ok(peak(l) < 1.6, `${name} too hot: ${peak(l)}`);
    }
  });

  it('pluck dies away on its own; pad swells in slowly', () => {
    const pluck = runSource(new PolySynth(SR, 'pluck'), 1.2, [[0, (s) => s.noteOn(60, 1)]]).l;
    assert.ok(rms(pluck, Math.floor(0.9 * SR), Math.floor(1.1 * SR)) < rms(pluck, 0, Math.floor(0.1 * SR)) * 0.15);
    const pad = runSource(new PolySynth(SR, 'pad'), 1, [[0, (s) => s.noteOn(60, 1)]]).l;
    assert.ok(rms(pad, 0, Math.floor(0.05 * SR)) < rms(pad, Math.floor(0.6 * SR), Math.floor(0.7 * SR)) * 0.25);
  });

  it('velocity scales level on a curve', () => {
    const lvl = (v: number) => peak(runSource(new PolySynth(SR, 'organ'), 0.5, [[0, (s) => s.noteOn(60, v)]]).l);
    assert.ok(Math.abs(lvl(0.5) / lvl(1) - 0.5 ** 1.5) < 0.05);
  });

  it('never holds more notes than its voice limit, and stealing does not click', () => {
    const synth = new PolySynth(SR, 'organ', 4);
    const { l } = runSource(synth, 1, [[0, (s) => [60, 62, 64, 65, 67, 69, 71, 72].forEach((n) => s.noteOn(n, 1))]]);
    assert.ok(synth.activeVoices <= 4, `voices ${synth.activeVoices}`);
    assert.ok(l.every(Number.isFinite));
    assert.ok(maxStep(l, 0, 0.05) < 0.5);
  });

  it('is identical whatever the block size (control-rate updates are per voice, not per block)', () => {
    const render = (chunk: number) => {
      const synth = new PolySynth(SR, 'pluck');
      const l = new Float32Array(SR / 2);
      const r = new Float32Array(SR / 2);
      synth.noteOn(55, 0.9);
      synth.noteOn(62, 0.7);
      for (let i = 0; i < l.length; i += chunk) synth.render(l, r, i, Math.min(l.length, i + chunk));
      return l;
    };
    assert.deepEqual(render(64), render(500));
  });
});

describe('Sampler', () => {
  const tone = (hz: number, sr = SR, seconds = 1) => ({ channels: [sine(hz, seconds, sr)], sampleRate: sr });

  it('transposes by semitones: root plays at pitch, +12 doubles, -12 halves', () => {
    for (const [note, hz] of [[69, 440], [81, 880], [57, 220]] as const) {
      const s = new Sampler(SR, { rootNote: 69 });
      s.load(tone(440));
      const { l } = runSource(s, 0.5, [[0, (x) => x.noteOn(note, 1)]]);
      assert.ok(Math.abs(zeroCrossFreq(l, 0.05, 0.4) / hz - 1) < 0.005, `note ${note}`);
    }
  });

  it('plays a sample recorded at another rate at the right pitch', () => {
    const s = new Sampler(SR, { rootNote: 69 });
    s.load(tone(440, 22050));
    const { l } = runSource(s, 0.4, [[0, (x) => x.noteOn(69, 1)]]);
    assert.ok(Math.abs(zeroCrossFreq(l, 0.05, 0.35) / 440 - 1) < 0.005);
  });

  it('Hermite interpolation reproduces a transposed sine to better than 0.1 %', () => {
    const s = new Sampler(SR, { rootNote: 69, attack: 0.0005 });
    s.load(tone(440));
    // +7 semitones: rate 2^(7/12), an awkward fractional step
    const { l } = runSource(s, 0.3, [[0, (x) => x.noteOn(76, 1)]]);
    const rate = 2 ** (7 / 12);
    let worst = 0;
    for (let i = Math.floor(0.02 * SR); i < Math.floor(0.25 * SR); i++) {
      const ideal = Math.sin((2 * Math.PI * 440 * rate * i) / SR);
      worst = Math.max(worst, Math.abs((l[i] as number) - ideal));
    }
    assert.ok(worst < 1e-3, `worst error ${worst}`);
  });

  it('slices mode plays exactly one slice per note and stops at its end', () => {
    const parts = [200, 400, 800, 1600].map((hz) => sine(hz, 0.25));
    const data = { channels: [Float32Array.from(parts.flatMap((p) => [...p]))], sampleRate: SR };
    const s = new Sampler(SR, { mode: 'slices', sliceBase: 36, slices: [0, 1, 2, 3].map((i) => ({ start: i * 0.25, end: (i + 1) * 0.25 })) });
    s.load(data);
    const { l } = runSource(s, 0.6, [[0, (x) => x.noteOn(38, 1)]]);
    const at = (hz: number) => goertzel(l, hz, SR, Math.floor(0.02 * SR), Math.floor(0.23 * SR));
    assert.ok(at(800) > at(200) * 50 && at(800) > at(1600) * 50);
    assert.ok(peak(l, Math.floor(0.27 * SR), l.length) < 1e-3, 'slice ran past its end');
    const none = runSource(s, 0.2, [[0, (x) => x.noteOn(60, 1)]]).l;
    assert.equal(peak(none), 0, 'a note with no slice must be silent');
  });

  it('one-shot ignores note-off; a gated sample releases on note-off', () => {
    const run = (oneShot: boolean) => {
      const s = new Sampler(SR, { rootNote: 69, oneShot, release: 0.02 });
      s.load(tone(440));
      return runSource(s, 0.8, [[0, (x) => x.noteOn(69, 1)], [0.2, (x) => x.noteOff(69)]]).l;
    };
    assert.ok(peak(run(true), Math.floor(0.4 * SR), Math.floor(0.6 * SR)) > 0.5);
    assert.ok(peak(run(false), Math.floor(0.45 * SR), Math.floor(0.7 * SR)) < 1e-3);
  });

  it('reverse plays the sample backwards', () => {
    const ramp = Float32Array.from({ length: 4410 }, (_, i) => i / 4410);
    const s = new Sampler(SR, { rootNote: 60, reverse: true, attack: 0.0005 });
    s.load({ channels: [ramp], sampleRate: SR });
    const { l } = runSource(s, 0.1, [[0, (x) => x.noteOn(60, 1)]]);
    assert.ok((l[40] as number) > (l[3000] as number), 'should fall while reversed');
  });

  it('loops while held and stops after release', () => {
    const s = new Sampler(SR, { rootNote: 69, loop: true, release: 0.02 });
    s.load(tone(440, SR, 0.1));
    const { l } = runSource(s, 1, [[0, (x) => x.noteOn(69, 1)], [0.6, (x) => x.noteOff(69)]]);
    assert.ok(rms(l, Math.floor(0.4 * SR), Math.floor(0.55 * SR)) > 0.4, 'did not loop past the sample length');
    assert.ok(peak(l, Math.floor(0.8 * SR), l.length) < 1e-3);
  });

  it('keeps stereo channels apart', () => {
    const s = new Sampler(SR, { rootNote: 69 });
    s.load({ channels: [sine(440, 1), new Float32Array(SR)], sampleRate: SR });
    const { l, r } = runSource(s, 0.3, [[0, (x) => x.noteOn(69, 1)]]);
    assert.ok(peak(l) > 0.8 && peak(r) === 0);
  });

  it('survives too many notes, an empty load and no sample at all', () => {
    const s = new Sampler(SR);
    assert.equal(peak(runSource(s, 0.1, [[0, (x) => x.noteOn(60, 1)]]).l), 0);
    s.load(tone(440));
    const { l } = runSource(s, 0.3, [[0, (x) => { for (let i = 0; i < 40; i++) x.noteOn(40 + (i % 30), 1); }]]);
    assert.ok(s.activeVoices <= 16 && l.every(Number.isFinite));
    s.load(null);
    assert.equal(peak(runSource(s, 0.1, [[0, (x) => x.noteOn(60, 1)]]).l), 0);
  });
});
