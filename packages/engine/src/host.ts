import type { Project } from '@pro-studio/shared';
import { compileProject } from './compile';
import { Engine, type ChannelSpec, type TimedEvent } from './engine';
import type { HostCommand, HostTelemetry } from './protocol';
import { EMPTY_PATTERN, Sequencer } from './sequencer';

/** Telemetry rate: position and meters go to the UI about this many times a second. */
const TELEMETRY_HZ = 30;

/**
 * Everything the audio thread does, with no Web Audio in it: apply commands, render blocks, report telemetry.
 * The AudioWorklet is a thin shell around this class, and tests and server renders drive it directly.
 */
export class EngineHost {
  readonly engine: Engine;
  readonly sequencer: Sequencer;
  private readonly specs = new Map<string, string>();
  private live: TimedEvent[] = [];
  private framesSinceTelemetry = 0;
  private readonly telemetryEvery: number;
  private telemetry: HostTelemetry[] = [];

  constructor(readonly sampleRate: number) {
    this.engine = new Engine(sampleRate);
    this.sequencer = new Sequencer(sampleRate);
    this.sequencer.setPattern(EMPTY_PATTERN);
    this.telemetryEvery = Math.round(sampleRate / TELEMETRY_HZ);
    this.syncDelayTime();
  }

  private syncDelayTime(): void {
    // a dotted eighth, the usual trap/R&B echo, locked to the tempo
    this.engine.setDelayTime(this.sequencer.beatSeconds * 0.75);
  }

  private addChannel(spec: ChannelSpec, mix?: Parameters<Engine['addChannel']>[1]): void {
    this.engine.addChannel(spec, mix);
    this.specs.set(spec.id, JSON.stringify(spec));
  }

  private applyProject(project: Project): void {
    const c = compileProject(project);
    const keep = new Set<string>();
    for (const { spec, mix } of c.channels) {
      keep.add(spec.id);
      if (this.specs.get(spec.id) === JSON.stringify(spec) && this.engine.hasChannel(spec.id)) this.engine.setMix(spec.id, mix);
      else this.addChannel(spec, mix);
    }
    for (const id of this.engine.channelIds) {
      if (!keep.has(id)) {
        this.engine.removeChannel(id);
        this.specs.delete(id);
      }
    }
    this.sequencer.setTempo(c.bpm);
    this.sequencer.setSwing(c.swing);
    this.sequencer.setPattern(c.pattern);
    this.engine.masterGain = c.masterGain;
    this.syncDelayTime();
  }

  handle(cmd: HostCommand): void {
    switch (cmd.type) {
      case 'setProject':
        this.applyProject(cmd.project);
        break;
      case 'addChannel':
        this.addChannel(cmd.spec, cmd.mix);
        break;
      case 'removeChannel':
        this.engine.removeChannel(cmd.id);
        this.specs.delete(cmd.id);
        break;
      case 'setMix':
        this.engine.setMix(cmd.id, cmd.mix);
        break;
      case 'setParams':
        this.engine.setParams(cmd.id, cmd.params);
        break;
      case 'loadSample':
        this.engine.loadSample(cmd.id, cmd.data);
        break;
      case 'setPattern':
        this.sequencer.setPattern(cmd.pattern);
        break;
      case 'setTempo':
        this.sequencer.setTempo(cmd.bpm);
        this.syncDelayTime();
        break;
      case 'setSwing':
        this.sequencer.setSwing(cmd.swing);
        break;
      case 'setMasterGain':
        this.engine.masterGain = Math.max(0, Math.min(1.5, cmd.gain));
        break;
      case 'noteOn':
        this.live.push({ offset: 0, event: { type: 'noteOn', channel: cmd.channel, note: cmd.note, velocity: cmd.velocity, slide: cmd.slide } });
        break;
      case 'noteOff':
        this.live.push({ offset: 0, event: { type: 'noteOff', channel: cmd.channel, note: cmd.note } });
        break;
      case 'allNotesOff':
        this.engine.allNotesOff();
        break;
      case 'play':
        this.sequencer.play();
        break;
      case 'pause':
        this.sequencer.pause();
        this.engine.allNotesOff();
        break;
      case 'stop':
        this.sequencer.stop();
        this.engine.allNotesOff();
        break;
      case 'seek':
        this.sequencer.seek(cmd.tick);
        this.engine.allNotesOff();
        break;
    }
  }

  /** Render one block. Live notes land on the first frame, sequenced notes on their exact frame. */
  process(outL: Float32Array, outR: Float32Array, frames: number = outL.length): void {
    const timed = this.sequencer.advance(frames);
    const events = this.live.length === 0 ? timed : [...this.live, ...timed];
    this.live = [];
    this.engine.process(outL, outR, frames, events);
    this.framesSinceTelemetry += frames;
    if (this.framesSinceTelemetry >= this.telemetryEvery) {
      this.framesSinceTelemetry = 0;
      this.telemetry.push({ type: 'position', tick: this.sequencer.positionTicks, loopTick: this.sequencer.loopTicks, playing: this.sequencer.playing });
      this.telemetry.push({ type: 'meters', meters: this.engine.readMeters(), nonFiniteSamples: this.engine.nonFiniteSamples });
    }
  }

  /** Telemetry produced since the last call. */
  takeTelemetry(): HostTelemetry[] {
    const t = this.telemetry;
    this.telemetry = [];
    return t;
  }
}
