/**
 * Messages between the UI and the audio thread. The UI only ever sends commands and reads telemetry:
 * sound is made entirely on the audio side, so a busy page can never make it stutter.
 */
import type { Project } from '@pro-studio/shared';
import type { ChannelMix, ChannelSpec, Meters } from './engine';
import type { Pattern } from './sequencer';
import type { Bass808Params } from './sources/bass808';
import type { SampleData, SamplerParams } from './sources/sampler';

export type HostCommand =
  /** Replace the whole project (diffed: unchanged channels keep sounding). */
  | { type: 'setProject'; project: Project }
  | { type: 'addChannel'; spec: ChannelSpec; mix?: Partial<ChannelMix> }
  | { type: 'removeChannel'; id: string }
  | { type: 'setMix'; id: string; mix: Partial<ChannelMix> }
  | { type: 'setParams'; id: string; params: Partial<Bass808Params> | Partial<SamplerParams> }
  | { type: 'loadSample'; id: string; data: SampleData | null }
  | { type: 'setPattern'; pattern: Pattern }
  | { type: 'setTempo'; bpm: number }
  | { type: 'setSwing'; swing: number }
  | { type: 'setMasterGain'; gain: number }
  /** Live notes, for the on-screen and laptop keyboards and MIDI. */
  | { type: 'noteOn'; channel: string; note: number; velocity: number; slide?: boolean }
  | { type: 'noteOff'; channel: string; note: number }
  | { type: 'allNotesOff' }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'stop' }
  | { type: 'seek'; tick: number };

export type HostTelemetry =
  | { type: 'position'; tick: number; loopTick: number; playing: boolean }
  | { type: 'meters'; meters: Meters; nonFiniteSamples: number };
