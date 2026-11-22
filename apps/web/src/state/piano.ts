/**
 * Playing notes live: the laptop keys, the on-screen keys and the roll's key column all come through here.
 * Notes go to the channel selected in the rack (or the first instrument if a drum is selected or nothing is),
 * straight to the audio engine; nothing here waits for a React render.
 */
import { TypingPiano, createTypingInput, findChannel, type PianoEvent } from '@pro-studio/shared';
import { audioHost } from '../audio/audioHost';
import { heldNotes } from './keys';
import { createStore, useStore } from './store';
import { studio } from './studio';
import { uiState } from './ui';

export const piano = new TypingPiano({ layout: 'fl', baseMidi: 60 });

interface PianoUi {
  baseMidi: number;
  velocity: number;
  layout: typeof piano.layout;
  enabled: boolean;
}

const pianoUi = createStore<PianoUi>({ baseMidi: piano.baseMidi, velocity: piano.velocity, layout: piano.layout, enabled: true });
export const usePianoUi = <S,>(select: (s: PianoUi) => S): S => useStore(pianoUi, select);

/** What each held source (a key code or a pointer) started, so release stops the right note on the right channel. */
const sounding = new Map<string, { channel: string; note: number }>();

/** The channel notes are played into. */
export function targetChannelId(): string | null {
  const p = studio.get();
  const selected = uiState.get().selectedChannelId;
  if (selected && findChannel(p, selected)) return selected;
  return p.channels.find((c) => c.type === 'inst')?.id ?? p.channels[0]?.id ?? null;
}

let warned = false;

function noteOn(source: string, note: number, velocity127: number): void {
  const channel = targetChannelId();
  if (!channel) {
    if (!warned) uiState.announce('Add a channel to play notes.');
    warned = true;
    return;
  }
  if (sounding.has(source)) noteOff(source);
  sounding.set(source, { channel, note });
  heldNotes.down(note);
  void audioHost.sendFromGesture({ type: 'noteOn', channel, note, velocity: Math.max(0.05, Math.min(1, velocity127 / 127)) });
}

function noteOff(source: string): void {
  const s = sounding.get(source);
  if (!s) return;
  sounding.delete(source);
  audioHost.send({ type: 'noteOff', channel: s.channel, note: s.note });
  if (![...sounding.values()].some((o) => o.note === s.note)) heldNotes.up(s.note);
}

function emit(ev: PianoEvent): void {
  switch (ev.type) {
    case 'noteOn':
      noteOn(`key:${ev.code}`, ev.note, ev.velocity);
      break;
    case 'noteOff':
      noteOff(`key:${ev.code}`);
      break;
    case 'octave':
      pianoUi.set((s) => ({ ...s, baseMidi: ev.baseMidi }));
      break;
    case 'velocity':
      pianoUi.set((s) => ({ ...s, velocity: ev.velocity }));
      break;
  }
}

export const typing = createTypingInput(piano, emit);

/** A note pressed with a pointer (on-screen key, roll key column). `id` identifies the pointer. */
export function pressNote(id: string | number, note: number): void {
  noteOn(`ptr:${id}`, note, piano.velocity);
}
export function releaseNote(id: string | number): void {
  noteOff(`ptr:${id}`);
}

/** Play a note for a set time (a note just drawn in the roll). */
export function previewNote(channel: string, note: number, velocity: number, seconds: number): void {
  void audioHost.sendFromGesture({ type: 'noteOn', channel, note, velocity });
  setTimeout(() => audioHost.send({ type: 'noteOff', channel, note }), seconds * 1000);
}

export function releaseAllKeys(): void {
  for (const ev of piano.releaseAll()) emit(ev);
  for (const key of [...sounding.keys()]) noteOff(key);
  heldNotes.clear();
}

export const pianoActions = {
  shiftOctave(dir: 1 | -1): void {
    piano.shiftOctave(dir).forEach(emit);
  },
  setLayout(layout: typeof piano.layout): void {
    piano.setLayout(layout).forEach(emit);
    pianoUi.set((s) => ({ ...s, layout }));
  },
  setEnabled(on: boolean): void {
    piano.setEnabled(on).forEach(emit);
    pianoUi.set((s) => ({ ...s, enabled: on }));
  },
  /** Set the base note, e.g. so an 808 channel starts in its own octave. */
  setBase(baseMidi: number): void {
    const before = piano.baseMidi;
    const steps = Math.round((baseMidi - before) / 12);
    for (let i = 0; i < Math.abs(steps); i++) piano.shiftOctave(steps > 0 ? 1 : -1).forEach(emit);
  },
};

/** Wire the laptop keyboard to the piano. Returns the cleanup. Call once, at the app root. */
export function attachTypingPiano(): () => void {
  const down = (e: KeyboardEvent): void => {
    if (e.defaultPrevented) return; // a panel (the roll, a slider) already used this key
    typing.keyDown(e);
  };
  const up = (e: KeyboardEvent): void => typing.keyUp(e);
  const release = (): void => releaseAllKeys();
  const hide = (): void => {
    if (document.hidden) release();
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', release);
  document.addEventListener('visibilitychange', hide);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', release);
    document.removeEventListener('visibilitychange', hide);
    release();
  };
}
