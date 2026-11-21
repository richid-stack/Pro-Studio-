import { PPQ, swingTick } from '@pro-studio/shared';
import type { EngineEvent, TimedEvent } from './engine';

export interface PatternEvent {
  tick: number;
  durTicks: number;
  channel: string;
  note: number;
  velocity: number;
  slide?: boolean;
}

export interface Pattern {
  lengthTicks: number;
  events: PatternEvent[];
}

interface Entry {
  /** Swung position in ticks within the loop. */
  at: number;
  off: boolean;
  event: EngineEvent;
}

export const EMPTY_PATTERN: Pattern = { lengthTicks: PPQ * 4, events: [] };

function compile(pattern: Pattern, swing: number): Entry[] {
  const len = pattern.lengthTicks;
  const entries: Entry[] = [];
  for (const e of pattern.events) {
    if (e.tick < 0 || e.tick >= len) continue;
    const offTick = Math.min(len, e.tick + Math.max(1, e.durTicks));
    entries.push({ at: swingTick(e.tick, swing), off: false, event: { type: 'noteOn', channel: e.channel, note: e.note, velocity: e.velocity, slide: e.slide } });
    entries.push({ at: swingTick(offTick, swing), off: true, event: { type: 'noteOff', channel: e.channel, note: e.note } });
  }
  // note-offs first at the same instant, so a repeated note retriggers instead of being cut right after it starts
  return entries.sort((a, b) => a.at - b.at || Number(b.off) - Number(a.off));
}

/**
 * Turns a looping pattern into engine events with exact frame offsets. Every event's frame is computed from
 * its absolute tick, never accumulated, so the result is identical for any block size.
 */
export class Sequencer {
  private pattern: Pattern = EMPTY_PATTERN;
  private entries: Entry[] = [];
  private bpmValue = 120;
  private swingValue = 0;
  private running = false;
  /** Frames the transport has run since the last re-anchor. */
  private frame = 0;
  private anchorFrame = 0;
  private anchorTick = 0;
  private iter = 0;
  private idx = 0;

  constructor(private readonly sr: number) {}

  get bpm(): number {
    return this.bpmValue;
  }
  get swing(): number {
    return this.swingValue;
  }
  get playing(): boolean {
    return this.running;
  }
  get framesPerTick(): number {
    return (this.sr * 60) / (this.bpmValue * PPQ);
  }
  /** Seconds per quarter note, for tempo-synced effects. */
  get beatSeconds(): number {
    return 60 / this.bpmValue;
  }
  /** Absolute transport position in ticks. */
  get positionTicks(): number {
    return this.anchorTick + (this.frame - this.anchorFrame) / this.framesPerTick;
  }
  /** Position within the loop, in ticks. */
  get loopTicks(): number {
    const len = this.pattern.lengthTicks;
    return ((this.positionTicks % len) + len) % len;
  }

  setPattern(p: Pattern): void {
    this.pattern = p;
    this.entries = compile(p, this.swingValue);
    this.reposition();
  }

  setSwing(s: number): void {
    this.swingValue = Math.max(0, Math.min(1, s));
    this.entries = compile(this.pattern, this.swingValue);
    this.reposition();
  }

  setTempo(bpm: number): void {
    const next = Math.max(20, Math.min(400, bpm));
    if (next === this.bpmValue) return;
    this.anchorTick = this.positionTicks;
    this.anchorFrame = this.frame;
    this.bpmValue = next;
  }

  play(): void {
    if (this.running) return;
    this.running = true;
    this.reposition();
  }

  pause(): void {
    this.running = false;
  }

  /** Halt and rewind to the start of the loop. */
  stop(): void {
    this.running = false;
    this.seek(0);
  }

  seek(tick: number): void {
    this.anchorTick = Math.max(0, tick);
    this.anchorFrame = this.frame;
    this.reposition();
  }

  /** Put the cursor on the first entry that has not happened yet. */
  private reposition(): void {
    const len = this.pattern.lengthTicks;
    const pos = this.positionTicks;
    this.iter = Math.max(0, Math.floor(pos / len));
    const inLoop = pos - this.iter * len;
    let lo = 0;
    let hi = this.entries.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((this.entries[mid] as Entry).at < inLoop) lo = mid + 1;
      else hi = mid;
    }
    this.idx = lo;
    if (this.idx >= this.entries.length) {
      this.iter++;
      this.idx = 0;
    }
  }

  private frameOf(absTick: number): number {
    return this.anchorFrame + Math.round((absTick - this.anchorTick) * this.framesPerTick);
  }

  /** Events that fall in the next `frames` frames, with offsets relative to the block start. */
  advance(frames: number): TimedEvent[] {
    const out: TimedEvent[] = [];
    if (!this.running) return out;
    const end = this.frame + frames;
    const len = this.pattern.lengthTicks;
    if (this.entries.length > 0) {
      for (;;) {
        const entry = this.entries[this.idx] as Entry;
        const f = this.frameOf(this.iter * len + entry.at);
        if (f >= end) break;
        out.push({ offset: Math.max(0, f - this.frame), event: entry.event });
        if (++this.idx >= this.entries.length) {
          this.idx = 0;
          this.iter++;
        }
      }
    }
    this.frame = end;
    return out;
  }
}
