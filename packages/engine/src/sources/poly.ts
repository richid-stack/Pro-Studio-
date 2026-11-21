import { mtof } from '@pro-studio/shared';
import { Adsr, Biquad, oscSampleId, sinTurns, WAVE_ID } from '../dsp/primitives';
import type { Wave } from '../dsp/primitives';
import { type Source, velocityGain } from './source';

export interface OscSpec {
  wave: Wave;
  /** Frequency ratio against the note. */
  ratio: number;
  /** Detune in cents. */
  detune: number;
  gain: number;
}

export interface PolyPreset {
  oscs: readonly OscSpec[];
  amp: { a: number; d: number; s: number; r: number };
  filter: {
    /** Base cutoff in Hz, before keytracking and the envelope. */
    cutoff: number;
    q: number;
    /** Octaves the filter envelope opens the cutoff by. */
    envAmount: number;
    env: { a: number; d: number; s: number; r: number };
    /** 0 = fixed cutoff, 1 = cutoff follows the note one-for-one. */
    keytrack: number;
  };
  tremolo?: { rate: number; depth: number };
  gain: number;
}

export const POLY_PRESETS = {
  keys: {
    oscs: [
      { wave: 'sine', ratio: 1, detune: 0, gain: 1 },
      { wave: 'sine', ratio: 2, detune: 3, gain: 0.32 },
      { wave: 'sine', ratio: 4, detune: -2, gain: 0.1 },
    ],
    amp: { a: 0.004, d: 1.1, s: 0.18, r: 0.35 },
    filter: { cutoff: 1400, q: 0.7, envAmount: 2.6, env: { a: 0.001, d: 0.35, s: 0.1, r: 0.3 }, keytrack: 0.6 },
    tremolo: { rate: 5.2, depth: 0.1 },
    gain: 0.28,
  },
  pluck: {
    oscs: [
      { wave: 'saw', ratio: 1, detune: -7, gain: 0.6 },
      { wave: 'saw', ratio: 1, detune: 7, gain: 0.6 },
    ],
    amp: { a: 0.002, d: 0.3, s: 0, r: 0.12 },
    filter: { cutoff: 500, q: 1.1, envAmount: 4, env: { a: 0.001, d: 0.16, s: 0, r: 0.1 }, keytrack: 0.7 },
    gain: 0.26,
  },
  pad: {
    oscs: [
      { wave: 'saw', ratio: 1, detune: -12, gain: 0.45 },
      { wave: 'saw', ratio: 1, detune: 0, gain: 0.45 },
      { wave: 'saw', ratio: 1, detune: 12, gain: 0.45 },
    ],
    amp: { a: 0.35, d: 0.5, s: 0.85, r: 0.9 },
    filter: { cutoff: 1500, q: 0.8, envAmount: 1.5, env: { a: 0.6, d: 1.2, s: 0.5, r: 0.8 }, keytrack: 0.5 },
    gain: 0.24,
  },
  organ: {
    oscs: [
      { wave: 'sine', ratio: 1, detune: 0, gain: 1 },
      { wave: 'sine', ratio: 2, detune: 0, gain: 0.7 },
      { wave: 'sine', ratio: 3, detune: 0, gain: 0.4 },
      { wave: 'sine', ratio: 4, detune: 0, gain: 0.3 },
    ],
    amp: { a: 0.006, d: 0.02, s: 1, r: 0.07 },
    filter: { cutoff: 9000, q: 0.7, envAmount: 0, env: { a: 0.001, d: 0.1, s: 1, r: 0.1 }, keytrack: 0 },
    gain: 0.15,
  },
} as const satisfies Record<string, PolyPreset>;

export type PolyPresetName = keyof typeof POLY_PRESETS;

const CONTROL_RATE = 32;

class PolyVoice {
  note = -1;
  gated = false;
  age = 0;
  readonly amp: Adsr;
  readonly fenv: Adsr;
  readonly filter: Biquad;
  private readonly phases: number[];
  private gain = 0;
  private baseHz = 0;
  private tremPhase = 0;
  private tremGain = 1;
  /** Samples until the next control-rate filter update; counted per voice so output never depends on block size. */
  private ctl = 0;
  private readonly detuneRatios: number[];
  /** Per-oscillator phase increments for the current note, set once at note start. */
  private readonly dts: Float64Array;
  private readonly waves: Int8Array;
  private readonly oscGains: Float64Array;

  constructor(private readonly sr: number, private preset: PolyPreset) {
    this.detuneRatios = preset.oscs.map((o) => 2 ** (o.detune / 1200));
    this.dts = new Float64Array(preset.oscs.length);
    this.waves = Int8Array.from(preset.oscs.map((o) => WAVE_ID[o.wave as Wave]));
    this.oscGains = Float64Array.from(preset.oscs.map((o) => o.gain));
    this.amp = new Adsr(sr);
    this.fenv = new Adsr(sr);
    this.filter = new Biquad('lowpass', sr, preset.filter.cutoff, preset.filter.q);
    this.phases = preset.oscs.map(() => 0);
  }

  get active(): boolean {
    return !this.amp.done;
  }

  start(note: number, velocity: number): void {
    const p = this.preset;
    this.note = note;
    this.gated = true;
    this.age = 0;
    this.baseHz = mtof(note);
    for (let k = 0; k < p.oscs.length; k++) this.dts[k] = (this.baseHz * (p.oscs[k] as OscSpec).ratio * (this.detuneRatios[k] as number)) / this.sr;
    this.gain = velocityGain(velocity) * p.gain;
    this.amp.kill();
    this.fenv.kill();
    this.amp.set(p.amp.a, p.amp.d, p.amp.s, p.amp.r);
    this.fenv.set(p.filter.env.a, p.filter.env.d, p.filter.env.s, p.filter.env.r);
    this.amp.gate(true);
    this.fenv.gate(true);
    this.filter.reset();
    this.phases.fill(0);
    this.tremPhase = 0;
    this.tremGain = 1;
    this.ctl = 0;
  }

  release(fast = false): void {
    this.gated = false;
    if (fast) this.amp.set(this.preset.amp.a, this.preset.amp.d, this.preset.amp.s, 0.006);
    this.amp.gate(false);
    this.fenv.gate(false);
  }

  render(out: Float32Array, from: number, to: number): void {
    const p = this.preset;
    const nOsc = this.dts.length;
    const hasFilterEnv = p.filter.envAmount !== 0;
    for (let i = from; i < to; i++) {
      if (this.ctl-- <= 0) {
        this.ctl = CONTROL_RATE - 1;
        const key = 2 ** (((this.note - 60) / 12) * p.filter.keytrack);
        const cutoff = p.filter.cutoff * key * 2 ** (p.filter.envAmount * this.fenv.value);
        this.filter.tune(cutoff, p.filter.q);
        if (p.tremolo) {
          // a 5 Hz wobble only needs updating every ~0.7 ms
          this.tremPhase += (p.tremolo.rate * CONTROL_RATE) / this.sr;
          this.tremGain = 1 - p.tremolo.depth * 0.5 * (1 + sinTurns(this.tremPhase));
        }
      }
      if (hasFilterEnv) this.fenv.next();
      let s = 0;
      for (let k = 0; k < nOsc; k++) {
        const dt = this.dts[k] as number;
        let ph = (this.phases[k] as number) + dt;
        if (ph >= 1) ph -= 1;
        this.phases[k] = ph;
        s += oscSampleId(this.waves[k] as number, ph, dt) * (this.oscGains[k] as number);
      }
      const a = this.amp.next() * this.tremGain;
      out[i] = (out[i] as number) + this.filter.process(s) * a * this.gain;
      if (this.amp.done) break;
    }
    this.age += to - from;
  }
}

/** Polyphonic synth with a handful of musical presets. Voice stealing takes releasing voices first, then the oldest. */
export class PolySynth implements Source {
  private readonly voices: PolyVoice[];
  private readonly scratch: Float32Array;

  constructor(private readonly sr: number, readonly presetName: PolyPresetName, private readonly maxVoices = 16, maxBlock = 4096) {
    const preset: PolyPreset = POLY_PRESETS[presetName];
    this.voices = Array.from({ length: maxVoices + 6 }, () => new PolyVoice(sr, preset));
    this.scratch = new Float32Array(maxBlock);
  }

  get activeVoices(): number {
    return this.voices.reduce((n, v) => n + (v.active && v.gated ? 1 : 0), 0);
  }

  noteOn(note: number, velocity: number): void {
    // No allocation here: this runs on the audio thread.
    let gated = 0;
    let oldestGated: PolyVoice | null = null;
    let free: PolyVoice | null = null;
    let oldestReleasing: PolyVoice | null = null;
    for (const v of this.voices) {
      if (!v.active) {
        free ??= v;
      } else if (v.gated) {
        gated++;
        if (!oldestGated || v.age > oldestGated.age) oldestGated = v;
      } else if (!oldestReleasing || v.age > oldestReleasing.age) {
        oldestReleasing = v;
      }
    }
    if (gated >= this.maxVoices) oldestGated?.release(true);
    (free ?? oldestReleasing ?? oldestGated ?? (this.voices[0] as PolyVoice)).start(note, velocity);
  }

  noteOff(note: number): void {
    for (const v of this.voices) if (v.active && v.gated && v.note === note) v.release();
  }

  allNotesOff(): void {
    for (const v of this.voices) if (v.active && v.gated) v.release();
  }

  choke(): void {
    for (const v of this.voices) if (v.active) v.release(true);
  }

  render(l: Float32Array, r: Float32Array, from: number, to: number): void {
    const n = to - from;
    if (n > this.scratch.length) throw new RangeError(`block of ${n} frames exceeds maxBlock ${this.scratch.length}`);
    this.scratch.fill(0, 0, n);
    let any = false;
    for (const v of this.voices) {
      if (!v.active) continue;
      v.render(this.scratch, 0, n);
      any = true;
    }
    if (!any) return;
    for (let i = 0; i < n; i++) {
      const s = this.scratch[i] as number;
      l[from + i] = (l[from + i] as number) + s;
      r[from + i] = (r[from + i] as number) + s;
    }
  }
}
