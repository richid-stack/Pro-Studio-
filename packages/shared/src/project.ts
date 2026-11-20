/**
 * Project document model (schema v1). The document is plain JSON so it can be saved locally,
 * synced to the cloud and diffed. Any change to its shape bumps PROJECT_SCHEMA_VERSION and adds a migration.
 */
import type { Genre, ScaleId } from './theory';

export const PROJECT_SCHEMA_VERSION = 1;

/** One step of the sequencer is a 16th note. */
export const STEPS_PER_BAR = 16;
export const MAX_BARS = 4;

export interface Note {
  id: number;
  /** Start, in steps (fractional allowed). */
  t: number;
  /** Length, in steps. */
  d: number;
  /** MIDI note number. */
  n: number;
  /** Velocity 0..1. */
  v: number;
  /** Slide: glide into this note from the previous one. */
  s: boolean;
}

export interface MixSettings {
  db: number;
  pan: number;
  rev: number;
  dly: number;
  duck: number;
  mute: boolean;
  solo: boolean;
}

export type DrumName = 'kick' | 'snare' | 'clap' | 'hat' | 'ohat' | 'rim';
export type InstrumentName = 'sub' | 'rhodes' | 'pluck' | 'pad' | 'organ' | 'chop' | 'sampler';
export type RollShape = 'flat' | 'up' | 'down';

interface ChannelBase {
  id: string;
  name: string;
  color: string;
  mix: MixSettings;
}

export interface DrumChannel extends ChannelBase {
  type: 'drum';
  drum: DrumName;
  /** Velocity per step, 0 = off. */
  v: number[];
  /** Ratchet count per step, 1 = no roll. */
  r: number[];
  roll: RollShape;
}

export interface InstrumentChannel extends ChannelBase {
  type: 'inst';
  inst: InstrumentName;
  notes: Note[];
}

export type Channel = DrumChannel | InstrumentChannel;

export interface Sub808Params {
  decay: number;
  glide: number;
  drive: number;
}

export interface Project {
  version: typeof PROJECT_SCHEMA_VERSION;
  name: string;
  bpm: number;
  swing: number;
  human: number;
  genre: Genre;
  /** Tonic pitch class 0..11. */
  key: number;
  scale: ScaleId;
  bars: number;
  lock: boolean;
  masterDb: number;
  p808: Sub808Params;
  channels: Channel[];
}
