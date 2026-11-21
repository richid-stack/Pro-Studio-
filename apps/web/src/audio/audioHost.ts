/**
 * The main-thread side of the audio engine. It owns the AudioContext and the AudioWorkletNode, queues commands
 * until the worklet is ready, and republishes the worklet's telemetry (playhead, meters) to the UI.
 *
 * Browsers only start audio from a user gesture, so `start()` is called from the first key press or tap and
 * resumed on every later one if the browser suspended the context (background tab, phone interruption, a
 * silent switch). The UI never makes sound itself: it sends commands and reads telemetry.
 */
import type { HostCommand, HostTelemetry, Meters } from '@pro-studio/engine';
import workletUrl from './engine.worklet.ts?worker&url';

export type AudioStatus = 'idle' | 'starting' | 'running' | 'suspended' | 'unsupported' | 'failed';

export interface TransportTelemetry {
  playing: boolean;
  /** Position within the loop, in ticks. */
  loopTick: number;
}

const EMPTY_METERS: Meters = { channels: {}, masterL: 0, masterR: 0, voices: 0 };

class AudioHost {
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private starting: Promise<void> | null = null;
  private queue: HostCommand[] = [];
  private status: AudioStatus = typeof AudioContext === 'undefined' || typeof AudioWorkletNode === 'undefined' ? 'unsupported' : 'idle';
  private transport: TransportTelemetry = { playing: false, loopTick: 0 };
  private meters: Meters = EMPTY_METERS;
  private error = '';
  private readonly statusListeners = new Set<() => void>();
  private readonly telemetryListeners = new Set<() => void>();

  /* --------------------------------------------------------------- state */

  subscribeStatus = (l: () => void): (() => void) => {
    this.statusListeners.add(l);
    return () => this.statusListeners.delete(l);
  };
  getStatus = (): AudioStatus => this.status;
  getError = (): string => this.error;

  /** Called about 30 times a second while the engine runs; read `getTransport` and `getMeters` inside. */
  subscribeTelemetry = (l: () => void): (() => void) => {
    this.telemetryListeners.add(l);
    return () => this.telemetryListeners.delete(l);
  };
  getTransport = (): TransportTelemetry => this.transport;
  getMeters = (): Meters => this.meters;

  /** Seconds of delay between a command and sound, as reported by the browser. */
  getLatencyMs(): number | null {
    if (!this.ctx) return null;
    const out = (this.ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0;
    return Math.round((this.ctx.baseLatency + out) * 1000);
  }

  get sampleRate(): number | null {
    return this.ctx?.sampleRate ?? null;
  }

  private setStatus(next: AudioStatus): void {
    if (next === this.status) return;
    this.status = next;
    for (const l of this.statusListeners) l();
  }

  /* --------------------------------------------------------------- start */

  /** Create the context and load the worklet. Safe to call repeatedly; resumes a suspended context. */
  start(): Promise<void> {
    if (this.status === 'unsupported') return Promise.resolve();
    if (this.ctx && this.node) {
      if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => this.setStatus('suspended'));
      return Promise.resolve();
    }
    if (this.starting) return this.starting;
    this.setStatus('starting');
    this.starting = this.boot().catch((e: unknown) => {
      this.error = e instanceof Error ? e.message : String(e);
      this.setStatus('failed');
      this.starting = null;
    });
    return this.starting;
  }

  private async boot(): Promise<void> {
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    ctx.addEventListener('statechange', () => this.setStatus(ctx.state === 'running' ? 'running' : 'suspended'));
    // resume() must be called inside the gesture, before the first await
    const resumed = ctx.resume();
    await ctx.audioWorklet.addModule(workletUrl);
    const node = new AudioWorkletNode(ctx, 'pro-studio-engine', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
    node.port.onmessage = (e: MessageEvent<HostTelemetry[]>) => this.onTelemetry(e.data);
    node.connect(ctx.destination);
    this.node = node;
    await resumed.catch(() => undefined);
    this.setStatus(ctx.state === 'running' ? 'running' : 'suspended');
    for (const cmd of this.queue) node.port.postMessage(cmd);
    this.queue = [];
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && ctx.state !== 'running') void ctx.resume().catch(() => undefined);
    });
  }

  private onTelemetry(batch: HostTelemetry[]): void {
    for (const t of batch) {
      if (t.type === 'position') this.transport = { playing: t.playing, loopTick: t.loopTick };
      else this.meters = t.meters;
    }
    for (const l of this.telemetryListeners) l();
  }

  /* ------------------------------------------------------------ commands */

  /** Send a command. Before the worklet is ready it is queued (state commands keep only the latest of their kind). */
  send(cmd: HostCommand): void {
    if (this.node) {
      this.node.port.postMessage(cmd);
      return;
    }
    if (cmd.type === 'setProject') this.queue = this.queue.filter((c) => c.type !== 'setProject');
    // a live note that waited for the engine to load would sound late and stuck: drop stale ones
    if (this.queue.length > 256) this.queue.splice(0, this.queue.length - 256);
    this.queue.push(cmd);
  }

  /** Start the engine from a gesture and send a command once it is running. */
  async sendFromGesture(cmd: HostCommand): Promise<void> {
    this.send(cmd);
    await this.start();
  }
}

export const audioHost = new AudioHost();
