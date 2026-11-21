import type { DrumChannel, DrumName, InstrumentChannel, InstrumentName, MixSettings, Note, Project } from '@pro-studio/shared';

export const mix = (over: Partial<MixSettings> = {}): MixSettings => ({ db: -6, pan: 0, rev: 0, dly: 0, duck: 0, mute: false, solo: false, ...over });

export function drum(id: string, name: DrumName, steps: Record<number, number>, over: Partial<DrumChannel> = {}, length = 32): DrumChannel {
  const v = new Array<number>(length).fill(0);
  for (const [s, x] of Object.entries(steps)) v[Number(s)] = x;
  return { id, name: id, color: 'c', mix: mix(), type: 'drum', drum: name, v, r: new Array<number>(length).fill(1), roll: 'flat', ...over };
}

export function inst(id: string, kind: InstrumentName, notes: Array<[number, number, number, number?, boolean?]>, over: Partial<InstrumentChannel> = {}): InstrumentChannel {
  const ns: Note[] = notes.map(([t, d, n, v = 0.9, s = false], i) => ({ id: i + 1, t, d, n, v, s }));
  return { id, name: id, color: 'c', mix: mix(), type: 'inst', inst: kind, notes: ns, ...over };
}

/** Two bars of trap at 140 BPM: kick/snare/hats with rolls, open hat, sliding 808, a keys chord. Used by the render tests. */
export function trapProject(over: Partial<Project> = {}): Project {
  const hats: Record<number, number> = {};
  for (let i = 0; i < 32; i++) hats[i] = i % 2 === 0 ? 0.7 : 0.45;
  const hat = drum('hat', 'hat', hats);
  hat.r[14] = 3;
  hat.r[30] = 4;
  hat.roll = 'up';
  return {
    version: 1,
    name: 'fixture',
    bpm: 140,
    swing: 0,
    human: 0,
    genre: 'trap',
    key: 0,
    scale: 'minor',
    bars: 2,
    lock: false,
    masterDb: -1,
    p808: { decay: 1.2, glide: 0.08, drive: 0.35 },
    channels: [
      drum('kick', 'kick', { 0: 1, 10: 0.9, 16: 1, 26: 0.85 }),
      drum('snare', 'snare', { 8: 1, 24: 1 }),
      drum('clap', 'clap', { 8: 0.6, 24: 0.6 }),
      hat,
      drum('ohat', 'ohat', { 6: 0.6, 22: 0.6 }),
      inst('bass', 'sub', [[0, 6, 36], [10, 4, 39, 0.9, true], [16, 8, 34], [26, 4, 36, 0.9, true]]),
      inst('keys', 'rhodes', [[0, 8, 60, 0.7], [0, 8, 63, 0.7], [0, 8, 67, 0.7], [16, 8, 58, 0.7], [16, 8, 62, 0.7], [16, 8, 65, 0.7]]),
    ],
    ...over,
  };
}
