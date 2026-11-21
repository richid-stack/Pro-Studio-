import { Adsr, saturate, sinTurns, tauCoef } from '../dsp/primitives';
import { mtof } from '@pro-studio/shared';
import { type Source, velocityGain } from './source';

export interface Bass808Params {
  /** Approximate seconds for the note to die away (about -40 dB). */
  decay: number;
  /** Seconds to glide into a slid note. */
  glide: number;
  /** 0..1 saturation. Adds the harmonics that let an 808 be heard on a phone speaker. */
  drive: number;
  /** 0..1 pitch drop at the start of each note, the "thump". */
  punch: number;
}

export const DEFAULT_808: Bass808Params = { decay: 1.4, glide: 0.09, drive: 0.35, punch: 0.4 };

/**
 * Monophonic sub bass. A new note keeps the oscillator phase and the current level, so retriggering never
 * clicks; a slid note glides in pitch without retriggering the envelope.
 */
export class Bass808 implements Source {
  private readonly env: Adsr;
  private phase = 0;
  private freq = 0;
  private target = 0;
  private punch = 0;
  private gain = 0;
  private note = -1;
  private readonly params: Bass808Params;
  private glideCoef: number;
  private readonly punchCoef: number;

  constructor(private readonly sr: number, params: Partial<Bass808Params> = {}) {
    this.params = { ...DEFAULT_808, ...params };
    this.env = new Adsr(sr);
    this.env.set(0.003, this.params.decay / 5, 0, 0.02);
    this.glideCoef = tauCoef(this.params.glide / 3, sr);
    this.punchCoef = tauCoef(0.018, sr);
  }

  get activeVoices(): number {
    return this.env.done ? 0 : 1;
  }

  setParams(p: Partial<Bass808Params>): void {
    Object.assign(this.params, p);
    this.env.set(0.003, this.params.decay / 5, 0, 0.02);
    this.glideCoef = tauCoef(this.params.glide / 3, this.sr);
  }

  noteOn(note: number, velocity: number, slide = false): void {
    this.target = mtof(note);
    const sounding = this.env.stage === 'attack' || this.env.stage === 'decay' || this.env.stage === 'sustain';
    if (slide && sounding) {
      this.note = note;
      this.gain = velocityGain(velocity);
      return;
    }
    this.freq = this.target;
    this.punch = this.params.punch * 1.6;
    this.gain = velocityGain(velocity);
    this.note = note;
    this.env.set(0.003, this.params.decay / 5, 0, 0.02);
    this.env.gate(true);
  }

  noteOff(note: number): void {
    if (note === this.note) this.env.gate(false);
  }

  allNotesOff(): void {
    this.env.gate(false);
  }

  choke(): void {
    this.env.set(0.003, this.params.decay / 5, 0, 0.003);
    this.env.gate(false);
  }

  render(l: Float32Array, r: Float32Array, from: number, to: number): void {
    if (this.env.done) return;
    const drive = this.params.drive;
    for (let i = from; i < to; i++) {
      this.freq = this.target + (this.freq - this.target) * this.glideCoef;
      this.punch *= this.punchCoef;
      const f = this.freq * (1 + this.punch);
      this.phase += f / this.sr;
      if (this.phase >= 1) this.phase -= 1;
      const e = this.env.next();
      const s = saturate(sinTurns(this.phase), drive) * e * this.gain * 0.9;
      l[i] = (l[i] as number) + s;
      r[i] = (r[i] as number) + s;
      if (this.env.done) break;
    }
  }
}
