/**
 * Owns the AudioContext for keyboard playing. Browsers only allow audio to start from a user gesture,
 * so the context is created lazily on the first note and resumed on every later one if the browser
 * suspended it (tab in the background, phone interruption).
 */
import { KeySynth, type PresetId } from './keySynth';

export type AudioStatus = 'idle' | 'running' | 'suspended' | 'unsupported';

class KeyEngine {
  private ctx: AudioContext | null = null;
  private synth: KeySynth | null = null;
  private status: AudioStatus = typeof AudioContext === 'undefined' ? 'unsupported' : 'idle';
  private preset: PresetId = 'keys';
  private readonly listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getStatus = (): AudioStatus => this.status;

  private setStatus(next: AudioStatus): void {
    if (next === this.status) return;
    this.status = next;
    for (const l of this.listeners) l();
  }

  private ensure(): KeySynth | null {
    if (this.status === 'unsupported') return null;
    if (!this.ctx) {
      const ctx = new AudioContext({ latencyHint: 'interactive' });
      ctx.addEventListener('statechange', () => this.setStatus(ctx.state === 'running' ? 'running' : 'suspended'));
      this.ctx = ctx;
      this.synth = new KeySynth(ctx);
      this.synth.setPreset(this.preset);
    }
    if (this.ctx.state !== 'running') {
      void this.ctx.resume().catch(() => this.setStatus('suspended'));
    } else {
      this.setStatus('running');
    }
    return this.synth;
  }

  setPreset(id: PresetId): void {
    this.preset = id;
    this.synth?.setPreset(id);
  }

  noteOn(note: number, velocity: number, id: string): void {
    this.ensure()?.noteOn(note, velocity, id);
  }

  noteOff(id: string): void {
    this.synth?.noteOff(id);
  }

  allNotesOff(): void {
    this.synth?.allNotesOff();
  }
}

export const keyEngine = new KeyEngine();
