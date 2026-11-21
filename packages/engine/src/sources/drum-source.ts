import type { DrumName } from '@pro-studio/shared';
import { DRUM_VARIANTS, drumBuffer } from '../dsp/drums';
import { tauCoef } from '../dsp/primitives';
import { type Source, velocityGain } from './source';

interface Hit {
  buf: Float32Array;
  pos: number;
  gain: number;
  /** 1 while playing; multiplied down quickly once choked. */
  fade: number;
  choked: boolean;
}

const MAX_HITS = 12;

/** One drum on one channel. Hits are one-shots that ring out and overlap; round-robin variants rotate per hit. */
export class DrumSource implements Source {
  private readonly hits: Hit[] = [];
  private robin = 0;
  private readonly chokeCoef: number;

  constructor(private readonly drum: DrumName, private readonly sr: number) {
    this.chokeCoef = tauCoef(0.004, sr);
  }

  get activeVoices(): number {
    return this.hits.length;
  }

  noteOn(_note: number, velocity: number): void {
    const variant = this.robin++ % DRUM_VARIANTS[this.drum];
    if (this.hits.length >= MAX_HITS) this.hits.shift();
    this.hits.push({ buf: drumBuffer(this.drum, variant, this.sr), pos: 0, gain: velocityGain(velocity), fade: 1, choked: false });
  }

  noteOff(): void {
    /* one-shots ignore note-off */
  }

  allNotesOff(): void {
    this.choke();
  }

  choke(): void {
    for (const h of this.hits) h.choked = true;
  }

  render(l: Float32Array, r: Float32Array, from: number, to: number): void {
    for (let k = this.hits.length - 1; k >= 0; k--) {
      const h = this.hits[k] as Hit;
      const n = Math.min(to - from, h.buf.length - h.pos);
      let played = 0;
      let dead = false;
      for (; played < n; played++) {
        if (h.choked) {
          h.fade *= this.chokeCoef;
          // end the hit on the exact sample, not at the end of the block, or output would depend on block size
          if (h.fade < 1e-4) {
            dead = true;
            break;
          }
        }
        const s = (h.buf[h.pos + played] as number) * h.gain * h.fade;
        l[from + played] = (l[from + played] as number) + s;
        r[from + played] = (r[from + played] as number) + s;
      }
      h.pos += played;
      if (dead || h.pos >= h.buf.length) this.hits.splice(k, 1);
    }
  }
}
