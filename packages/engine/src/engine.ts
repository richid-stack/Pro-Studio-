import type { DrumName } from '@pro-studio/shared';
import { DRUM_CHOKES } from './dsp/drums';
import { panGains, softClip, tauCoef } from './dsp/primitives';
import { DuckEnvelope, Reverb, StereoDelay } from './fx/effects';
import { Bass808, type Bass808Params } from './sources/bass808';
import { DrumSource } from './sources/drum-source';
import { PolySynth, type PolyPresetName } from './sources/poly';
import { Sampler, type SampleData, type SamplerParams } from './sources/sampler';
import type { Source } from './sources/source';

export type ChannelSpec = { id: string } & (
  | { kind: 'drum'; drum: DrumName }
  | { kind: 'bass808'; params?: Partial<Bass808Params> }
  | { kind: 'poly'; preset: PolyPresetName; maxVoices?: number }
  | { kind: 'sampler'; params?: Partial<SamplerParams> }
);

export interface ChannelMix {
  /** Linear gain, 0..~1.5. */
  gain: number;
  /** -1 (left) .. 1 (right). */
  pan: number;
  /** Reverb send, 0..1. */
  rev: number;
  /** Delay send, 0..1. */
  dly: number;
  /** How far the kick pulls this channel down, 0..1 (sidechain feel without a compressor). */
  duck: number;
  mute: boolean;
  solo: boolean;
}

export const DEFAULT_MIX: ChannelMix = { gain: 0.8, pan: 0, rev: 0, dly: 0, duck: 0, mute: false, solo: false };

export type EngineEvent =
  | { type: 'noteOn'; channel: string; note: number; velocity: number; slide?: boolean }
  | { type: 'noteOff'; channel: string; note: number }
  | { type: 'allNotesOff'; channel?: string };

export interface TimedEvent {
  /** Frame within the block this event takes effect on. */
  offset: number;
  event: EngineEvent;
}

export interface Meters {
  /** Peak since the last read, per channel id, linear. */
  channels: Record<string, number>;
  masterL: number;
  masterR: number;
  voices: number;
}

interface Strip {
  id: string;
  spec: ChannelSpec;
  source: Source;
  mix: ChannelMix;
  gL: number;
  gR: number;
  peak: number;
}

const MAX_BLOCK = 2048;

/**
 * The sound engine: channels (each a Source with a mixer strip), send effects, a master bus with a soft
 * clipper, and sample-accurate event delivery. No Web Audio, no DOM: it renders into plain Float32Arrays.
 */
export class Engine {
  readonly sampleRate: number;
  private readonly strips = new Map<string, Strip>();
  private readonly delay: StereoDelay;
  private readonly reverb: Reverb;
  private readonly duck: DuckEnvelope;
  private readonly smooth: number;
  masterGain = 0.9;
  /** Count of non-finite samples replaced with silence. Should stay 0; surfaced so a bug is visible, not an ear-splitting burst. */
  nonFiniteSamples = 0;
  private masterPeakL = 0;
  private masterPeakR = 0;

  private readonly srcL = new Float32Array(MAX_BLOCK);
  private readonly srcR = new Float32Array(MAX_BLOCK);
  private readonly dryL = new Float32Array(MAX_BLOCK);
  private readonly dryR = new Float32Array(MAX_BLOCK);
  private readonly revIn = new Float32Array(MAX_BLOCK);
  private readonly dlyIn = new Float32Array(MAX_BLOCK);
  private readonly wetL = new Float32Array(MAX_BLOCK);
  private readonly wetR = new Float32Array(MAX_BLOCK);
  private readonly duckBuf = new Float32Array(MAX_BLOCK);

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
    this.delay = new StereoDelay(sampleRate);
    this.reverb = new Reverb(sampleRate);
    this.duck = new DuckEnvelope(sampleRate);
    this.smooth = tauCoef(0.008, sampleRate);
  }

  addChannel(spec: ChannelSpec, mix: Partial<ChannelMix> = {}): void {
    this.removeChannel(spec.id);
    const sr = this.sampleRate;
    let source: Source;
    switch (spec.kind) {
      case 'drum':
        source = new DrumSource(spec.drum, sr);
        break;
      case 'bass808':
        source = new Bass808(sr, spec.params);
        break;
      case 'poly':
        source = new PolySynth(sr, spec.preset, spec.maxVoices ?? 16, MAX_BLOCK);
        break;
      case 'sampler':
        source = new Sampler(sr, spec.params);
        break;
    }
    const m = { ...DEFAULT_MIX, ...mix };
    const [l, r] = panGains(m.pan);
    // start at the target (muted channels start silent), so only later changes glide
    const start = m.mute ? 0 : m.gain;
    this.strips.set(spec.id, { id: spec.id, spec, source, mix: m, gL: l * start, gR: r * start, peak: 0 });
  }

  removeChannel(id: string): void {
    this.strips.get(id)?.source.allNotesOff();
    this.strips.delete(id);
  }

  hasChannel(id: string): boolean {
    return this.strips.has(id);
  }

  get channelIds(): string[] {
    return [...this.strips.keys()];
  }

  setMix(id: string, mix: Partial<ChannelMix>): void {
    const s = this.strips.get(id);
    if (!s) return;
    // a NaN from the UI must never reach the audio path: ignore non-finite numbers, keep the old value
    for (const [k, v] of Object.entries(mix) as Array<[keyof ChannelMix, number | boolean]>) {
      if (typeof v === 'boolean') (s.mix[k] as boolean) = v;
      else if (Number.isFinite(v)) (s.mix[k] as number) = v;
    }
  }

  /** Update instrument parameters live (808 decay and glide, sampler root note and slices). */
  setParams(id: string, params: Partial<Bass808Params> | Partial<SamplerParams>): void {
    const s = this.strips.get(id);
    if (!s) return;
    if (s.source instanceof Bass808) s.source.setParams(params as Partial<Bass808Params>);
    else if (s.source instanceof Sampler) s.source.setParams(params as Partial<SamplerParams>);
  }

  loadSample(id: string, data: SampleData | null): void {
    const s = this.strips.get(id);
    if (s?.source instanceof Sampler) s.source.load(data);
  }

  setDelayTime(seconds: number): void {
    this.delay.setTime(seconds);
  }

  setDelayFeedback(f: number): void {
    this.delay.feedback = Math.max(0, Math.min(0.95, f));
  }

  get voiceCount(): number {
    let n = 0;
    for (const s of this.strips.values()) n += s.source.activeVoices;
    return n;
  }

  allNotesOff(): void {
    for (const s of this.strips.values()) s.source.allNotesOff();
  }

  /** Read and reset the peak meters. */
  readMeters(): Meters {
    const channels: Record<string, number> = {};
    for (const s of this.strips.values()) {
      channels[s.id] = s.peak;
      s.peak = 0;
    }
    const m = { channels, masterL: this.masterPeakL, masterR: this.masterPeakR, voices: this.voiceCount };
    this.masterPeakL = 0;
    this.masterPeakR = 0;
    return m;
  }

  /**
   * Render `frames` samples into outL / outR (overwritten). `events` must be sorted by offset; each takes
   * effect exactly on its frame, so timing never depends on the block size.
   */
  process(outL: Float32Array, outR: Float32Array, frames: number, events: readonly TimedEvent[] = []): void {
    let cursor = 0;
    let e = 0;
    while (cursor < frames) {
      const blockEnd = Math.min(frames, cursor + MAX_BLOCK);
      let segEnd = blockEnd;
      // apply every event due at or before the cursor, then render up to the next one
      while (e < events.length && (events[e] as TimedEvent).offset <= cursor) {
        this.apply((events[e] as TimedEvent).event);
        e++;
      }
      if (e < events.length) segEnd = Math.min(segEnd, Math.max(cursor + 1, (events[e] as TimedEvent).offset));
      this.renderSegment(outL, outR, cursor, segEnd);
      cursor = segEnd;
    }
  }

  private apply(ev: EngineEvent): void {
    switch (ev.type) {
      case 'noteOn': {
        const s = this.strips.get(ev.channel);
        if (!s) return;
        if (s.spec.kind === 'drum') {
          if (s.spec.drum === 'kick') this.duck.trigger();
          for (const other of this.strips.values()) {
            if (other !== s && other.spec.kind === 'drum' && DRUM_CHOKES[s.spec.drum]?.includes(other.spec.drum)) other.source.choke();
          }
        }
        s.source.noteOn(ev.note, ev.velocity, ev.slide);
        break;
      }
      case 'noteOff':
        this.strips.get(ev.channel)?.source.noteOff(ev.note);
        break;
      case 'allNotesOff':
        if (ev.channel) this.strips.get(ev.channel)?.source.allNotesOff();
        else this.allNotesOff();
        break;
    }
  }

  private renderSegment(outL: Float32Array, outR: Float32Array, from: number, to: number): void {
    // local, zero-based working range so the scratch buffers can stay small
    const n = to - from;
    this.dryL.fill(0, 0, n);
    this.dryR.fill(0, 0, n);
    this.revIn.fill(0, 0, n);
    this.dlyIn.fill(0, 0, n);
    for (let i = 0; i < n; i++) this.duckBuf[i] = this.duck.next();

    let anySolo = false;
    for (const s of this.strips.values()) if (s.mix.solo) anySolo = true;

    for (const s of this.strips.values()) {
      this.srcL.fill(0, 0, n);
      this.srcR.fill(0, 0, n);
      s.source.render(this.srcL, this.srcR, 0, n);
      const audible = !s.mix.mute && (!anySolo || s.mix.solo);
      const [pl, pr] = panGains(s.mix.pan);
      const tl = audible ? pl * s.mix.gain : 0;
      const tr = audible ? pr * s.mix.gain : 0;
      const rev = s.mix.rev;
      const dly = s.mix.dly;
      const duck = s.mix.duck;
      let peak = 0;
      for (let i = 0; i < n; i++) {
        s.gL = tl + (s.gL - tl) * this.smooth;
        s.gR = tr + (s.gR - tr) * this.smooth;
        const d = duck > 0 ? 1 - duck * (this.duckBuf[i] as number) : 1;
        const l = (this.srcL[i] as number) * s.gL * d;
        const r = (this.srcR[i] as number) * s.gR * d;
        this.dryL[i] = (this.dryL[i] as number) + l;
        this.dryR[i] = (this.dryR[i] as number) + r;
        if (rev > 0 || dly > 0) {
          const mono = (l + r) * 0.5;
          this.revIn[i] = (this.revIn[i] as number) + mono * rev;
          this.dlyIn[i] = (this.dlyIn[i] as number) + mono * dly;
        }
        const a = Math.max(Math.abs(l), Math.abs(r));
        if (a > peak) peak = a;
      }
      if (peak > s.peak) s.peak = peak;
    }

    this.wetL.fill(0, 0, n);
    this.wetR.fill(0, 0, n);
    this.reverb.process(this.revIn, this.revIn, this.wetL, this.wetR, 0, n);
    this.delay.process(this.dlyIn, this.dlyIn, this.wetL, this.wetR, 0, n);

    for (let i = 0; i < n; i++) {
      let l = softClip(((this.dryL[i] as number) + (this.wetL[i] as number)) * this.masterGain);
      let r = softClip(((this.dryR[i] as number) + (this.wetR[i] as number)) * this.masterGain);
      if (!Number.isFinite(l)) {
        l = 0;
        this.nonFiniteSamples++;
      }
      if (!Number.isFinite(r)) {
        r = 0;
        this.nonFiniteSamples++;
      }
      outL[from + i] = l;
      outR[from + i] = r;
      const al = Math.abs(l);
      const ar = Math.abs(r);
      if (al > this.masterPeakL) this.masterPeakL = al;
      if (ar > this.masterPeakR) this.masterPeakR = ar;
    }
  }
}
