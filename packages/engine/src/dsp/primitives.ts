/**
 * Low-level DSP building blocks. Pure TypeScript with no Web Audio and no DOM, so the same code runs
 * in an AudioWorklet, in Node tests and on a server render. Nothing here allocates inside a per-sample path.
 */

/** Seeded random numbers in [0, 1): the engine must render the same audio for the same project, always. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** White noise in [-1, 1). */
export function whiteNoise(rand: () => number): number {
  return rand() * 2 - 1;
}

/** Tonic-preserving soft clipper: identity below `knee`, smoothly approaches `ceiling`, never exceeds it. */
export function softClip(x: number, knee = 0.6, ceiling = 0.98): number {
  const a = Math.abs(x);
  if (a <= knee) return x;
  const room = ceiling - knee;
  const y = knee + room * Math.tanh((a - knee) / room);
  return x < 0 ? -y : y;
}

/** Waveshaper used for drive: smooth, odd-symmetric, level-normalised at full scale. */
export function saturate(x: number, drive: number): number {
  if (drive <= 0) return x;
  const k = 1 + drive * 8;
  return Math.tanh(k * x) / Math.tanh(k);
}

/** Equal-power pan, pan in [-1, 1]. Returns the left and right gains. */
export function panGains(pan: number): [number, number] {
  // exact at the ends: a hard-panned channel must leave the other side truly silent, not 1e-17
  if (pan <= -1) return [1, 0];
  if (pan >= 1) return [0, 1];
  const p = (Math.max(-1, Math.min(1, pan)) + 1) * 0.25 * Math.PI;
  return [Math.cos(p), Math.sin(p)];
}

/** One-pole coefficient for a time constant in seconds: y += (target - y) * (1 - coef). */
export function tauCoef(seconds: number, sr: number): number {
  return seconds <= 0 ? 0 : Math.exp(-1 / (seconds * sr));
}

/* ------------------------------------------------------------- envelopes */

/** Exponential interpolation through (time, value) points; values must be positive. Holds the last value. */
export function expEnvelope(points: ReadonlyArray<readonly [number, number]>): (t: number) => number {
  return (t) => {
    const first = points[0] as readonly [number, number];
    if (t <= first[0]) return first[1];
    for (let i = 1; i < points.length; i++) {
      const [t1, v1] = points[i] as readonly [number, number];
      if (t <= t1) {
        const [t0, v0] = points[i - 1] as readonly [number, number];
        return v0 * (v1 / v0) ** ((t - t0) / (t1 - t0));
      }
    }
    return (points[points.length - 1] as readonly [number, number])[1];
  };
}

export type AdsrStage = 'idle' | 'attack' | 'decay' | 'sustain' | 'release';

const IDLE = 0;
const ATTACK = 1;
const DECAY = 2;
const SUSTAIN = 3;
const RELEASE = 4;
const STAGE_NAMES: readonly AdsrStage[] = ['idle', 'attack', 'decay', 'sustain', 'release'];

/**
 * Click-free ADSR: linear attack, then exponential decay and release. `done` once the release is inaudible.
 * Stages are numbers inside (it runs once per voice per sample); `stage` gives the readable name.
 */
export class Adsr {
  private st = IDLE;
  value = 0;
  private attackStep = 1;
  private decayCoef = 0;
  private releaseCoef = 0;
  private sustain = 1;

  constructor(private readonly sr: number) {}

  get stage(): AdsrStage {
    return STAGE_NAMES[this.st] as AdsrStage;
  }

  set(attack: number, decay: number, sustain: number, release: number): void {
    this.attackStep = attack <= 0 ? 1 : 1 / (attack * this.sr);
    this.decayCoef = tauCoef(decay, this.sr);
    this.releaseCoef = tauCoef(release, this.sr);
    this.sustain = Math.max(0, Math.min(1, sustain));
  }

  gate(on: boolean): void {
    if (on) this.st = ATTACK;
    else if (this.st !== IDLE) this.st = RELEASE;
  }

  /** Jump straight to silence (voice stealing is faded elsewhere; this is for reset only). */
  kill(): void {
    this.st = IDLE;
    this.value = 0;
  }

  get done(): boolean {
    return this.st === IDLE;
  }

  next(): number {
    const st = this.st;
    if (st === SUSTAIN || st === IDLE) return this.value;
    if (st === ATTACK) {
      this.value += this.attackStep;
      if (this.value >= 1) {
        this.value = 1;
        this.st = DECAY;
      }
    } else if (st === DECAY) {
      this.value = this.sustain + (this.value - this.sustain) * this.decayCoef;
      if (this.value - this.sustain < 1e-5) this.st = SUSTAIN;
    } else {
      this.value *= this.releaseCoef;
      if (this.value < 1e-4) {
        this.value = 0;
        this.st = IDLE;
      }
    }
    return this.value;
  }
}

/* --------------------------------------------------------------- filters */

export type BiquadType = 'lowpass' | 'highpass' | 'bandpass' | 'peaking' | 'lowshelf' | 'highshelf';

/** RBJ cookbook biquad, transposed direct form II. Coefficients can be retuned per block without clicks. */
export class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private z1 = 0;
  private z2 = 0;

  constructor(
    private readonly type: BiquadType,
    private readonly sr: number,
    freq: number,
    q = Math.SQRT1_2,
    gainDb = 0,
  ) {
    this.tune(freq, q, gainDb);
  }

  tune(freq: number, q = Math.SQRT1_2, gainDb = 0): void {
    const f = Math.max(10, Math.min(freq, this.sr * 0.49));
    const w0 = (2 * Math.PI * f) / this.sr;
    const cos = Math.cos(w0);
    const sin = Math.sin(w0);
    const qq = Math.max(0.05, q);
    const alpha = sin / (2 * qq);
    const A = 10 ** (gainDb / 40);
    let b0 = 1;
    let b1 = 0;
    let b2 = 0;
    let a0 = 1;
    let a1 = 0;
    let a2 = 0;
    switch (this.type) {
      case 'lowpass':
        b0 = (1 - cos) / 2;
        b1 = 1 - cos;
        b2 = b0;
        a0 = 1 + alpha;
        a1 = -2 * cos;
        a2 = 1 - alpha;
        break;
      case 'highpass':
        b0 = (1 + cos) / 2;
        b1 = -(1 + cos);
        b2 = b0;
        a0 = 1 + alpha;
        a1 = -2 * cos;
        a2 = 1 - alpha;
        break;
      case 'bandpass':
        b0 = alpha;
        b1 = 0;
        b2 = -alpha;
        a0 = 1 + alpha;
        a1 = -2 * cos;
        a2 = 1 - alpha;
        break;
      case 'peaking':
        b0 = 1 + alpha * A;
        b1 = -2 * cos;
        b2 = 1 - alpha * A;
        a0 = 1 + alpha / A;
        a1 = -2 * cos;
        a2 = 1 - alpha / A;
        break;
      case 'lowshelf': {
        const s = 2 * Math.sqrt(A) * alpha;
        b0 = A * (A + 1 - (A - 1) * cos + s);
        b1 = 2 * A * (A - 1 - (A + 1) * cos);
        b2 = A * (A + 1 - (A - 1) * cos - s);
        a0 = A + 1 + (A - 1) * cos + s;
        a1 = -2 * (A - 1 + (A + 1) * cos);
        a2 = A + 1 + (A - 1) * cos - s;
        break;
      }
      case 'highshelf': {
        const s = 2 * Math.sqrt(A) * alpha;
        b0 = A * (A + 1 + (A - 1) * cos + s);
        b1 = -2 * A * (A - 1 + (A + 1) * cos);
        b2 = A * (A + 1 + (A - 1) * cos - s);
        a0 = A + 1 - (A - 1) * cos + s;
        a1 = 2 * (A - 1 - (A + 1) * cos);
        a2 = A + 1 - (A - 1) * cos - s;
        break;
      }
    }
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
  }

  reset(): void {
    this.z1 = 0;
    this.z2 = 0;
  }

  process(x: number): number {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
}

/* ----------------------------------------------------------- oscillators */

/**
 * PolyBLEP residual: removes most of the aliasing from a naive saw or square by smoothing the
 * discontinuity over two samples. `t` is the phase in [0, 1), `dt` the phase increment per sample.
 */
export function polyBlep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

// sin(2*pi*x) as an odd polynomial on [-1/4, 1/4], Horner form; error below 1e-7
const TWO_PI = 2 * Math.PI;
const S1 = TWO_PI;
const S3 = -(TWO_PI ** 3) / 6;
const S5 = TWO_PI ** 5 / 120;
const S7 = -(TWO_PI ** 7) / 5040;
const S9 = TWO_PI ** 9 / 362880;
const S11 = -(TWO_PI ** 11) / 39916800;

/**
 * Sine of a phase in turns (1 = a full cycle): fold into a quarter cycle, then a short polynomial. Accurate to
 * about 1e-7 (below any audible artefact) and cheaper than Math.sin when dozens of voices run several per sample.
 */
export function sinTurns(phase: number): number {
  let x = phase - Math.floor(phase);
  if (x > 0.5) x -= 1;
  if (x > 0.25) x = 0.5 - x;
  else if (x < -0.25) x = -0.5 - x;
  const x2 = x * x;
  return x * (S1 + x2 * (S3 + x2 * (S5 + x2 * (S7 + x2 * (S9 + x2 * S11)))));
}

export type Wave = 'sine' | 'saw' | 'square' | 'triangle';

/** Numeric waveform ids for the per-sample path (comparing strings per sample is measurably slow). */
export const WAVE_ID: Record<Wave, number> = { sine: 0, saw: 1, square: 2, triangle: 3 };

/** One band-limited oscillator sample by numeric id. Phase advances elsewhere; `dt` is frequency / sampleRate. */
export function oscSampleId(id: number, phase: number, dt: number): number {
  if (id === 1) return 2 * phase - 1 - polyBlep(phase, dt);
  if (id === 0) return sinTurns(phase);
  if (id === 2) {
    const other = phase + 0.5;
    return (phase < 0.5 ? 1 : -1) + polyBlep(phase, dt) - polyBlep(other >= 1 ? other - 1 : other, dt);
  }
  return 1 - 4 * Math.abs(phase - 0.5);
}

/** Same by name, for tests and offline rendering. */
export function oscSample(wave: Wave, phase: number, dt: number): number {
  return oscSampleId(WAVE_ID[wave], phase, dt);
}

/** Cubic Hermite (Catmull-Rom) interpolation between y1 and y2 at fraction f. Far less dull than linear. */
export function hermite(y0: number, y1: number, y2: number, y3: number, f: number): number {
  const c0 = y1;
  const c1 = 0.5 * (y2 - y0);
  const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
  const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
  return ((c3 * f + c2) * f + c1) * f + c0;
}

/* -------------------------------------------------------------- analysis */

/** Goertzel: energy of one frequency in a signal. Used by tests and by the tuner, not on the audio path. */
export function goertzel(x: ArrayLike<number>, freq: number, sr: number, from = 0, to = x.length): number {
  const w = (2 * Math.PI * freq) / sr;
  const coeff = 2 * Math.cos(w);
  let s1 = 0;
  let s2 = 0;
  for (let i = from; i < to; i++) {
    const s0 = (x[i] as number) + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const n = to - from;
  return (s1 * s1 + s2 * s2 - coeff * s1 * s2) / (n * n);
}

export function rms(x: ArrayLike<number>, from = 0, to = x.length): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += (x[i] as number) ** 2;
  return Math.sqrt(sum / Math.max(1, to - from));
}

export function peak(x: ArrayLike<number>, from = 0, to = x.length): number {
  let p = 0;
  for (let i = from; i < to; i++) p = Math.max(p, Math.abs(x[i] as number));
  return p;
}
