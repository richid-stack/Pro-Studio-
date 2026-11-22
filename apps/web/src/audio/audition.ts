/** Preview a sound from the browser panel without adding it to the project. */
import { specFor } from '@pro-studio/engine';
import { createStarterProject, dbToGain, type SoundEntry } from '@pro-studio/shared';
import { audioHost } from './audioHost';

const AUDITION_ID = 'audition';
/** The 808's usual settings, so it auditions the way it sounds when added. */
const P808 = createStarterProject('trap').p808;
const MIX = { db: 0, pan: 0, rev: 0, dly: 0, duck: 0, mute: false, solo: false };
let releaseTimer: ReturnType<typeof setTimeout> | undefined;

export function audition(sound: SoundEntry): void {
  clearTimeout(releaseTimer);
  const spec =
    sound.kind === 'drum'
      ? specFor({ id: AUDITION_ID, name: sound.label, color: 'ch-1', mix: MIX, type: 'drum', drum: sound.drum, v: [], r: [], roll: 'flat' }, P808)
      : specFor({ id: AUDITION_ID, name: sound.label, color: 'ch-1', mix: MIX, type: 'inst', inst: sound.inst, notes: [] }, P808);
  const note = sound.kind === 'drum' ? 60 : sound.auditionNote;
  void audioHost.sendFromGesture({ type: 'addChannel', spec, mix: { gain: dbToGain(-4) } });
  audioHost.send({ type: 'noteOn', channel: AUDITION_ID, note, velocity: 0.9 });
  if (sound.kind === 'inst') releaseTimer = setTimeout(() => audioHost.send({ type: 'noteOff', channel: AUDITION_ID, note }), sound.auditionSeconds * 1000);
}
