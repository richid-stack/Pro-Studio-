/** Anything that makes sound for a channel. Sources render into stereo buffers; the mixer strip handles level and pan. */
export interface Source {
  /** `slide` glides from the previous note on mono instruments instead of retriggering. */
  noteOn(note: number, velocity: number, slide?: boolean): void;
  noteOff(note: number): void;
  allNotesOff(): void;
  /** Fade anything playing out quickly (a closed hat shutting an open one). */
  choke(): void;
  /** Add this source's audio into `l` and `r` over frames [from, to). */
  render(l: Float32Array, r: Float32Array, from: number, to: number): void;
  readonly activeVoices: number;
}

/** MIDI velocity 0..1 to gain. A gentle curve so soft hits are soft and the top of the range is not shouting. */
export const velocityGain = (v: number): number => Math.max(0, Math.min(1, v)) ** 1.5;
