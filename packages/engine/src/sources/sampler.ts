import { Adsr, hermite } from '../dsp/primitives';
import { type Source, velocityGain } from './source';

/** Audio the sampler plays: one array per channel (mono or stereo) at the sample's own rate. */
export interface SampleData {
  channels: Float32Array[];
  sampleRate: number;
}

export interface Slice {
  /** Seconds into the sample. */
  start: number;
  end: number;
}

export interface SamplerParams {
  /** The MIDI note that plays the sample at its original pitch. */
  rootNote: number;
  /** `pitched`: notes transpose the sample. `slices`: note `sliceBase + i` plays slice i at original pitch (chopping). */
  mode: 'pitched' | 'slices';
  slices: Slice[];
  sliceBase: number;
  attack: number;
  release: number;
  /** Ignore note-off and play to the end (drum hits, chops). */
  oneShot: boolean;
  loop: boolean;
  reverse: boolean;
}

export const DEFAULT_SAMPLER: SamplerParams = {
  rootNote: 60,
  mode: 'pitched',
  slices: [],
  sliceBase: 36,
  attack: 0.002,
  release: 0.04,
  oneShot: false,
  loop: false,
  reverse: false,
};

const POOL = 16;
const EDGE_FADE_SECONDS = 0.002;

class SampleVoice {
  active = false;
  gated = false;
  note = -1;
  age = 0;
  pos = 0;
  rate = 1;
  start = 0;
  end = 0;
  gain = 0;
  readonly env: Adsr;
  constructor(sr: number) {
    this.env = new Adsr(sr);
  }
}

/**
 * Sample player. Playback uses cubic Hermite interpolation, so transposed notes keep their top end,
 * and a sample recorded at another rate than the engine plays at the right pitch.
 */
export class Sampler implements Source {
  private data: SampleData | null = null;
  private readonly params: SamplerParams;
  private readonly voices: SampleVoice[];

  constructor(private readonly sr: number, params: Partial<SamplerParams> = {}) {
    this.params = { ...DEFAULT_SAMPLER, ...params };
    this.voices = Array.from({ length: POOL }, () => new SampleVoice(sr));
  }

  get activeVoices(): number {
    return this.voices.filter((v) => v.active).length;
  }

  get hasSample(): boolean {
    return this.data !== null;
  }

  load(data: SampleData | null): void {
    this.allNotesOff();
    this.data = data;
    for (const v of this.voices) v.active = false;
  }

  setParams(p: Partial<SamplerParams>): void {
    Object.assign(this.params, p);
  }

  noteOn(note: number, velocity: number): void {
    const d = this.data;
    if (!d || d.channels.length === 0) return;
    const frames = (d.channels[0] as Float32Array).length;
    const p = this.params;
    let start = 0;
    let end = frames;
    let rate = d.sampleRate / this.sr;
    if (p.mode === 'slices') {
      const slice = p.slices[note - p.sliceBase];
      if (!slice) return;
      start = Math.max(0, Math.min(frames, slice.start * d.sampleRate));
      end = Math.max(start, Math.min(frames, slice.end * d.sampleRate));
    } else {
      rate *= 2 ** ((note - p.rootNote) / 12);
    }
    if (end - start < 2) return;
    let voice: SampleVoice | undefined;
    let oldest: SampleVoice | undefined;
    for (const v of this.voices) {
      if (!v.active) {
        voice = v;
        break;
      }
      if (!oldest || v.age > oldest.age) oldest = v;
    }
    voice ??= oldest;
    if (!voice) return;
    voice.active = true;
    voice.gated = true;
    voice.note = note;
    voice.age = 0;
    voice.start = start;
    voice.end = end;
    voice.rate = p.reverse ? -rate : rate;
    voice.pos = p.reverse ? end - 1 : start;
    voice.gain = velocityGain(velocity);
    voice.env.kill();
    voice.env.set(p.attack, 0.1, 1, p.release);
    voice.env.gate(true);
  }

  noteOff(note: number): void {
    if (this.params.oneShot || this.params.mode === 'slices') return;
    for (const v of this.voices) {
      if (v.active && v.gated && v.note === note) {
        v.gated = false;
        v.env.gate(false);
      }
    }
  }

  allNotesOff(): void {
    for (const v of this.voices) {
      if (v.active && v.gated) {
        v.gated = false;
        v.env.gate(false);
      }
    }
  }

  choke(): void {
    for (const v of this.voices) {
      if (v.active) {
        v.env.set(0.001, 0.1, 1, 0.005);
        v.gated = false;
        v.env.gate(false);
      }
    }
  }

  render(l: Float32Array, r: Float32Array, from: number, to: number): void {
    const d = this.data;
    if (!d) return;
    const left = d.channels[0] as Float32Array;
    const right = (d.channels[1] ?? left) as Float32Array;
    const last = left.length - 1;
    const edge = Math.max(1, Math.floor(EDGE_FADE_SECONDS * d.sampleRate));
    const sample = (ch: Float32Array, i: number): number => (i < 0 || i > last ? 0 : (ch[i] as number));
    for (const v of this.voices) {
      if (!v.active) continue;
      for (let i = from; i < to; i++) {
        const idx = Math.floor(v.pos);
        const f = v.pos - idx;
        const a = hermite(sample(left, idx - 1), sample(left, idx), sample(left, idx + 1), sample(left, idx + 2), f);
        const b = hermite(sample(right, idx - 1), sample(right, idx), sample(right, idx + 1), sample(right, idx + 2), f);
        const remaining = v.rate > 0 ? v.end - v.pos : v.pos - v.start;
        const edgeGain = remaining < edge ? Math.max(0, remaining / edge) : 1;
        const g = v.env.next() * v.gain * edgeGain;
        l[i] = (l[i] as number) + a * g;
        r[i] = (r[i] as number) + b * g;
        v.pos += v.rate;
        v.age++;
        const past = v.rate > 0 ? v.pos >= v.end : v.pos <= v.start;
        if (past) {
          if (this.params.loop && v.gated) {
            v.pos = v.rate > 0 ? v.start + (v.pos - v.end) : v.end - 1 - (v.start - v.pos);
          } else {
            v.active = false;
            break;
          }
        }
        if (v.env.done) {
          v.active = false;
          break;
        }
      }
    }
  }
}
