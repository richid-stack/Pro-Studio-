/**
 * A small polyphonic synth for playing from the keyboard. Phase 0 stand-in for the worklet engine
 * (docs/ARCHITECTURE.md section 3): it takes any BaseAudioContext, so it can also render offline.
 * Presets are data, not code paths.
 */
import { mtof } from '@pro-studio/shared';

export type PresetId = 'keys' | 'pluck' | 'sub808';

export const PRESETS: readonly { id: PresetId; label: string; hint: string }[] = [
  { id: 'keys', label: 'Keys', hint: 'Warm, sustained keys' },
  { id: 'pluck', label: 'Pluck', hint: 'Short, bright pluck' },
  { id: 'sub808', label: '808', hint: 'Deep sub bass with a pitch drop' },
];

interface PresetParams {
  waves: readonly [OscillatorType, OscillatorType];
  /** Gain of the second oscillator, 0..1. */
  mix2: number;
  /** Detune of the second oscillator in cents. */
  detune: number;
  cutoffBase: number;
  /** Extra cutoff in Hz at full velocity. */
  cutoffVel: number;
  q: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  level: number;
  /** Seconds for the filter to fall from its velocity-scaled peak to the base cutoff. 0 = static filter. */
  filterSweep: number;
  /** Start the pitch at `ratio` times the note and fall to it over `time` seconds. */
  pitchDrop?: { ratio: number; time: number };
}

const PARAMS: Readonly<Record<PresetId, PresetParams>> = {
  keys: { waves: ['sawtooth', 'triangle'], mix2: 0.8, detune: 7, cutoffBase: 900, cutoffVel: 5200, q: 0.7, attack: 0.008, decay: 0.45, sustain: 0.55, release: 0.28, level: 0.2, filterSweep: 0 },
  pluck: { waves: ['square', 'sawtooth'], mix2: 0.6, detune: 5, cutoffBase: 600, cutoffVel: 6500, q: 1.4, attack: 0.002, decay: 0.24, sustain: 0, release: 0.12, level: 0.22, filterSweep: 0.28 },
  sub808: { waves: ['sine', 'sine'], mix2: 0, detune: 0, cutoffBase: 20000, cutoffVel: 0, q: 0.5, attack: 0.003, decay: 1.6, sustain: 0.6, release: 0.3, level: 0.55, filterSweep: 0, pitchDrop: { ratio: 2.2, time: 0.06 } },
};

const MAX_VOICES = 24;
const STEAL_RELEASE = 0.03;

interface Voice {
  oscs: OscillatorNode[];
  gain: GainNode;
  filter: BiquadFilterNode;
  params: PresetParams;
  releasing: boolean;
}

export class KeySynth {
  private readonly ctx: BaseAudioContext;
  private readonly master: GainNode;
  private readonly limiter: DynamicsCompressorNode;
  private readonly voices = new Map<string, Voice>();
  private preset: PresetId = 'keys';

  constructor(ctx: BaseAudioContext, destination: AudioNode = ctx.destination) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    // Safety limiter so a handful of voices never clip the output.
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -8;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 10;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.12;
    this.master.connect(this.limiter);
    this.limiter.connect(destination);
  }

  get activeVoices(): number {
    return this.voices.size;
  }

  setPreset(id: PresetId): void {
    this.preset = id;
  }

  /** Start a note. `id` identifies the source (a key code, a pointer) so the same note can come from two places. */
  noteOn(note: number, velocity: number, id: string = String(note)): void {
    if (this.voices.has(id)) this.release(id, STEAL_RELEASE);
    if (this.voices.size >= MAX_VOICES) {
      const oldest = this.voices.keys().next().value;
      if (oldest !== undefined) this.release(oldest, STEAL_RELEASE);
    }
    const { ctx } = this;
    const t = ctx.currentTime;
    const p = PARAMS[this.preset];
    const v01 = Math.min(1, Math.max(1, velocity) / 127);
    const amp = p.level * Math.pow(v01, 1.4);
    const freq = mtof(note);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = p.q;
    const peakCut = Math.min(18000, p.cutoffBase + p.cutoffVel * v01);
    filter.frequency.setValueAtTime(peakCut, t);
    if (p.filterSweep > 0) filter.frequency.exponentialRampToValueAtTime(Math.max(40, p.cutoffBase), t + p.filterSweep);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(amp, t + p.attack);
    gain.gain.setTargetAtTime(amp * p.sustain, t + p.attack, p.decay / 3);

    const oscs: OscillatorNode[] = [];
    for (let i = 0; i < 2; i++) {
      const mix = i === 0 ? 1 : p.mix2;
      if (mix <= 0) continue;
      const osc = ctx.createOscillator();
      osc.type = p.waves[i] ?? 'sine';
      osc.detune.value = i === 0 ? 0 : p.detune;
      if (p.pitchDrop) {
        osc.frequency.setValueAtTime(freq * p.pitchDrop.ratio, t);
        osc.frequency.exponentialRampToValueAtTime(freq, t + p.pitchDrop.time);
      } else {
        osc.frequency.setValueAtTime(freq, t);
      }
      const oscGain = ctx.createGain();
      oscGain.gain.value = mix;
      osc.connect(oscGain);
      oscGain.connect(filter);
      oscs.push(osc);
    }
    filter.connect(gain);
    gain.connect(this.master);

    const voice: Voice = { oscs, gain, filter, params: p, releasing: false };
    this.voices.set(id, voice);
    const autoStop = p.sustain === 0 ? t + p.attack + p.decay * 2.5 : undefined;
    for (const osc of oscs) {
      osc.start(t);
      if (autoStop !== undefined) osc.stop(autoStop);
    }
    const first = oscs[0];
    if (first) {
      first.onended = () => {
        for (const o of oscs) o.disconnect();
        filter.disconnect();
        gain.disconnect();
        if (this.voices.get(id) === voice) this.voices.delete(id);
      };
    }
  }

  noteOff(id: string): void {
    this.release(id);
  }

  allNotesOff(): void {
    for (const id of [...this.voices.keys()]) this.release(id);
  }

  dispose(): void {
    this.allNotesOff();
    this.master.disconnect();
    this.limiter.disconnect();
  }

  private release(id: string, seconds?: number): void {
    const v = this.voices.get(id);
    if (!v || v.releasing) return;
    v.releasing = true;
    const now = this.ctx.currentTime;
    const rel = seconds ?? v.params.release;
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setValueAtTime(v.gain.gain.value, now);
    v.gain.gain.setTargetAtTime(0, now, rel / 4);
    for (const osc of v.oscs) {
      try {
        osc.stop(now + rel * 1.6 + 0.02);
      } catch {
        // Already stopped by its own envelope: nothing to do.
      }
    }
  }
}
