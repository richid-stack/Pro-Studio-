import { Biquad, tauCoef } from '../dsp/primitives';

/** Stereo feedback delay with a darkening filter in the loop, so repeats sit behind the dry sound. */
export class StereoDelay {
  private readonly bufL: Float32Array;
  private readonly bufR: Float32Array;
  private w = 0;
  private delaySamples: number;
  private readonly lpL: Biquad;
  private readonly lpR: Biquad;
  feedback = 0.38;

  constructor(private readonly sr: number, seconds = 0.375, maxSeconds = 2) {
    const size = Math.ceil(maxSeconds * sr) + 1;
    this.bufL = new Float32Array(size);
    this.bufR = new Float32Array(size);
    this.delaySamples = Math.round(seconds * sr);
    this.lpL = new Biquad('lowpass', sr, 4200);
    this.lpR = new Biquad('lowpass', sr, 4200);
  }

  /** Delay time in seconds, clamped to the buffer. Ping-pong: the right channel is offset by half again. */
  setTime(seconds: number): void {
    this.delaySamples = Math.max(1, Math.min(this.bufL.length - 1, Math.round(seconds * this.sr)));
  }

  process(inL: Float32Array, inR: Float32Array, outL: Float32Array, outR: Float32Array, from: number, to: number): void {
    const size = this.bufL.length;
    for (let i = from; i < to; i++) {
      const rd = (this.w - this.delaySamples + size) % size;
      const dl = this.bufL[rd] as number;
      const dr = this.bufR[rd] as number;
      // ping-pong: each side feeds the other
      this.bufL[this.w] = (inL[i] as number) + this.lpR.process(dr) * this.feedback;
      this.bufR[this.w] = (inR[i] as number) + this.lpL.process(dl) * this.feedback;
      outL[i] = (outL[i] as number) + dl;
      outR[i] = (outR[i] as number) + dr;
      this.w = (this.w + 1) % size;
    }
  }
}

const COMB_TUNING = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASS_TUNING = [556, 441, 341, 225];
const STEREO_SPREAD = 23;

class Comb {
  private readonly buf: Float32Array;
  private i = 0;
  private store = 0;
  constructor(size: number, private readonly feedback: number, private readonly damp: number) {
    this.buf = new Float32Array(size);
  }
  process(x: number): number {
    const out = this.buf[this.i] as number;
    this.store = out * (1 - this.damp) + this.store * this.damp;
    this.buf[this.i] = x + this.store * this.feedback;
    if (++this.i >= this.buf.length) this.i = 0;
    return out;
  }
}

class Allpass {
  private readonly buf: Float32Array;
  private i = 0;
  constructor(size: number) {
    this.buf = new Float32Array(size);
  }
  process(x: number): number {
    const b = this.buf[this.i] as number;
    const out = -x + b;
    this.buf[this.i] = x + b * 0.5;
    if (++this.i >= this.buf.length) this.i = 0;
    return out;
  }
}

/** Freeverb-style reverb (parallel damped combs into series allpasses), scaled to the sample rate. Output is wet only. */
export class Reverb {
  private readonly combsL: Comb[];
  private readonly combsR: Comb[];
  private readonly apL: Allpass[];
  private readonly apR: Allpass[];
  private readonly wetGain = 0.25;

  constructor(sr: number, size = 0.8, damp = 0.25) {
    const scale = sr / 44100;
    const feedback = 0.7 + size * 0.28;
    const mk = (n: number): number => Math.max(8, Math.round(n * scale));
    this.combsL = COMB_TUNING.map((n) => new Comb(mk(n), feedback, damp));
    this.combsR = COMB_TUNING.map((n) => new Comb(mk(n + STEREO_SPREAD), feedback, damp));
    this.apL = ALLPASS_TUNING.map((n) => new Allpass(mk(n)));
    this.apR = ALLPASS_TUNING.map((n) => new Allpass(mk(n + STEREO_SPREAD)));
  }

  process(inL: Float32Array, inR: Float32Array, outL: Float32Array, outR: Float32Array, from: number, to: number): void {
    for (let i = from; i < to; i++) {
      const x = ((inL[i] as number) + (inR[i] as number)) * 0.03;
      let l = 0;
      let r = 0;
      for (const c of this.combsL) l += c.process(x);
      for (const c of this.combsR) r += c.process(x);
      for (const a of this.apL) l = a.process(l);
      for (const a of this.apR) r = a.process(r);
      outL[i] = (outL[i] as number) + l * this.wetGain * 8;
      outR[i] = (outR[i] as number) + r * this.wetGain * 8;
    }
  }
}

/** Sidechain-style ducking envelope: jumps to 1 on a trigger, falls back over `release` seconds. */
export class DuckEnvelope {
  value = 0;
  private readonly coef: number;
  constructor(sr: number, release = 0.16) {
    this.coef = tauCoef(release / 3, sr);
  }
  trigger(): void {
    this.value = 1;
  }
  next(): number {
    this.value *= this.coef;
    return this.value;
  }
}
