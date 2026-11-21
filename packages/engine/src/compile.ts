/** Turns a saved Project document into engine channels and a looping pattern. Pure: no audio, fully testable. */
import { buildRoll, dbToGain, STEP_TICKS, STEPS_PER_BAR, type Channel, type Project } from '@pro-studio/shared';
import { mulberry32 } from './dsp/primitives';
import type { ChannelMix, ChannelSpec } from './engine';
import type { Pattern, PatternEvent } from './sequencer';

export interface CompiledProject {
  channels: Array<{ spec: ChannelSpec; mix: ChannelMix }>;
  pattern: Pattern;
  bpm: number;
  swing: number;
  masterGain: number;
}

function specFor(ch: Channel, p808: Project['p808']): ChannelSpec {
  if (ch.type === 'drum') return { id: ch.id, kind: 'drum', drum: ch.drum };
  switch (ch.inst) {
    case 'sub':
      return { id: ch.id, kind: 'bass808', params: { decay: p808.decay, glide: p808.glide, drive: p808.drive } };
    case 'rhodes':
      return { id: ch.id, kind: 'poly', preset: 'keys' };
    case 'pluck':
      return { id: ch.id, kind: 'poly', preset: 'pluck' };
    case 'pad':
      return { id: ch.id, kind: 'poly', preset: 'pad' };
    case 'organ':
      return { id: ch.id, kind: 'poly', preset: 'organ' };
    case 'chop':
      return { id: ch.id, kind: 'sampler', params: { mode: 'slices', oneShot: true } };
    case 'sampler':
      return { id: ch.id, kind: 'sampler', params: { mode: 'pitched' } };
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Same project in, same events out: humanise uses a seed derived from the channel, never Math.random. */
export function compileProject(project: Project): CompiledProject {
  const lengthTicks = Math.max(1, project.bars) * STEPS_PER_BAR * STEP_TICKS;
  const steps = Math.max(1, project.bars) * STEPS_PER_BAR;
  const events: PatternEvent[] = [];
  const channels: CompiledProject['channels'] = [];
  const human = Math.max(0, Math.min(1, project.human));

  for (const ch of project.channels) {
    const m = ch.mix;
    channels.push({
      spec: specFor(ch, project.p808),
      mix: { gain: dbToGain(m.db), pan: m.pan, rev: m.rev, dly: m.dly, duck: m.duck, mute: m.mute, solo: m.solo },
    });
    if (ch.type === 'drum') {
      const rand = mulberry32(hash(ch.id));
      for (let s = 0; s < Math.min(steps, ch.v.length); s++) {
        const v = ch.v[s] as number;
        if (v <= 0) continue;
        const velocity = Math.max(0.05, Math.min(1, v * (1 + (rand() - 0.5) * human * 0.3)));
        const ratchet = Math.max(1, Math.floor(ch.r[s] ?? 1));
        const start = s * STEP_TICKS;
        if (ratchet > 1) {
          for (const hit of buildRoll({ startTick: start, lengthTicks: STEP_TICKS, hits: ratchet, shape: ch.roll, velocity, seed: hash(ch.id) + s })) {
            events.push({ tick: hit.tick, durTicks: STEP_TICKS / ratchet, channel: ch.id, note: 60, velocity: hit.velocity });
          }
        } else {
          events.push({ tick: start, durTicks: STEP_TICKS, channel: ch.id, note: 60, velocity });
        }
      }
    } else {
      for (const n of ch.notes) {
        events.push({
          tick: Math.round(n.t * STEP_TICKS),
          durTicks: Math.max(1, Math.round(n.d * STEP_TICKS)),
          channel: ch.id,
          note: n.n,
          velocity: n.v,
          slide: n.s,
        });
      }
    }
  }
  return { channels, pattern: { lengthTicks, events }, bpm: project.bpm, swing: project.swing, masterGain: dbToGain(project.masterDb) };
}
