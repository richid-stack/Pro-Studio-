/**
 * Typing keyboard as a piano: maps physical keys (KeyboardEvent.code, so it works on any layout)
 * to MIDI notes. Pure state machine; the UI feeds it key events and plays what comes out.
 *
 * Two layouts:
 *  - "ableton": home row = white keys, row above = black keys, Z/X shift the octave, C/V change velocity.
 *  - "fl": two rows like a two-manual keyboard (Z row + Q row), - and = shift the octave.
 */

export type KeyLayout = 'ableton' | 'fl';

const ABLETON_NOTES: Readonly<Record<string, number>> = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11,
  KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16, Quote: 17,
};

const FL_NOTES: Readonly<Record<string, number>> = {
  KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5, KeyG: 6, KeyB: 7, KeyH: 8, KeyN: 9, KeyJ: 10, KeyM: 11,
  Comma: 12, KeyL: 13, Period: 14, Semicolon: 15, Slash: 16,
  KeyQ: 12, Digit2: 13, KeyW: 14, Digit3: 15, KeyE: 16, KeyR: 17, Digit5: 18, KeyT: 19, Digit6: 20, KeyY: 21,
  Digit7: 22, KeyU: 23, KeyI: 24, Digit9: 25, KeyO: 26, Digit0: 27, KeyP: 28,
};

const LAYOUTS: Record<KeyLayout, { notes: Readonly<Record<string, number>>; octaveDown: string; octaveUp: string; velDown?: string; velUp?: string }> = {
  ableton: { notes: ABLETON_NOTES, octaveDown: 'KeyZ', octaveUp: 'KeyX', velDown: 'KeyC', velUp: 'KeyV' },
  fl: { notes: FL_NOTES, octaveDown: 'Minus', octaveUp: 'Equal' },
};

/** Short on-screen label for a KeyboardEvent.code: KeyA -> A, Digit5 -> 5, Semicolon -> ;. */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const punct: Readonly<Record<string, string>> = {
    Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Minus: '-', Equal: '=',
  };
  return punct[code] ?? code;
}

export type PianoEvent =
  | { type: 'noteOn'; note: number; velocity: number; code: string }
  | { type: 'noteOff'; note: number; code: string }
  | { type: 'octave'; baseMidi: number }
  | { type: 'velocity'; velocity: number };

export interface KeyLike {
  code: string;
  repeat?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

export interface TypingPianoOptions {
  layout?: KeyLayout;
  /** MIDI note of the lowest C on the keys. Default 60 (C4). Always a multiple of 12. */
  baseMidi?: number;
  /** MIDI velocity 1..127. Default 100. */
  velocity?: number;
}

const MIN_BASE = 12;
const MAX_BASE = 96;
const VELOCITY_STEP = 16;

export class TypingPiano {
  layout: KeyLayout;
  baseMidi: number;
  velocity: number;
  private enabled = true;
  /** key code -> the note it started, so releasing after an octave change stops the right note. */
  private readonly held = new Map<string, number>();

  constructor(opts: TypingPianoOptions = {}) {
    this.layout = opts.layout ?? 'ableton';
    this.baseMidi = Math.min(MAX_BASE, Math.max(MIN_BASE, opts.baseMidi ?? 60));
    this.velocity = Math.min(127, Math.max(1, opts.velocity ?? 100));
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get heldNotes(): number[] {
    return [...this.held.values()];
  }

  /** For each semitone above `baseMidi`, the key codes that play it in the current layout (FL has two rows, so an offset can have two). */
  keysByOffset(): Map<number, string[]> {
    const out = new Map<number, string[]>();
    for (const [code, offset] of Object.entries(LAYOUTS[this.layout].notes)) {
      const list = out.get(offset);
      if (list) list.push(code);
      else out.set(offset, [code]);
    }
    return out;
  }

  /** Whether this key belongs to the piano in the current layout (so the UI knows to swallow it). */
  handles(code: string): boolean {
    const l = LAYOUTS[this.layout];
    return code in l.notes || code === l.octaveDown || code === l.octaveUp || code === l.velDown || code === l.velUp;
  }

  keyDown(e: KeyLike): PianoEvent[] {
    if (!this.enabled || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return [];
    const l = LAYOUTS[this.layout];
    if (e.code === l.octaveDown || e.code === l.octaveUp) return this.shiftOctave(e.code === l.octaveUp ? 1 : -1);
    if (l.velDown && l.velUp && (e.code === l.velDown || e.code === l.velUp)) return this.stepVelocity(e.code === l.velUp ? 1 : -1);
    const offset = l.notes[e.code];
    if (offset === undefined || this.held.has(e.code)) return [];
    const note = this.baseMidi + offset;
    if (note > 127) return [];
    this.held.set(e.code, note);
    return [{ type: 'noteOn', note, velocity: this.velocity, code: e.code }];
  }

  /** Move the keys one octave up or down. Also used by on-screen buttons. Empty when already at the limit. */
  shiftOctave(dir: 1 | -1): PianoEvent[] {
    const next = this.baseMidi + dir * 12;
    if (next < MIN_BASE || next > MAX_BASE) return [];
    this.baseMidi = next;
    return [{ type: 'octave', baseMidi: next }];
  }

  /** Raise or lower the velocity one step. Empty when already at the limit. */
  stepVelocity(dir: 1 | -1): PianoEvent[] {
    const next = Math.min(127, Math.max(VELOCITY_STEP, this.velocity + dir * VELOCITY_STEP));
    if (next === this.velocity) return [];
    this.velocity = next;
    return [{ type: 'velocity', velocity: next }];
  }

  keyUp(e: Pick<KeyLike, 'code'>): PianoEvent[] {
    const note = this.held.get(e.code);
    if (note === undefined) return [];
    this.held.delete(e.code);
    return [{ type: 'noteOff', note, code: e.code }];
  }

  /** Stop everything (window blur, layout change, leaving the piano roll). */
  releaseAll(): PianoEvent[] {
    const out: PianoEvent[] = [...this.held].map(([code, note]) => ({ type: 'noteOff', note, code }));
    this.held.clear();
    return out;
  }

  setEnabled(on: boolean): PianoEvent[] {
    this.enabled = on;
    return on ? [] : this.releaseAll();
  }

  setLayout(layout: KeyLayout): PianoEvent[] {
    const off = this.releaseAll();
    this.layout = layout;
    return off;
  }
}
