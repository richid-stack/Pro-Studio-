import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PPQ, STEP_TICKS } from '@pro-studio/shared';
import { compileProject, type ChannelMix } from '../src/index';
import { drum, inst, trapProject } from './fixtures';

describe('compileProject', () => {
  it('maps every instrument to a source and carries the mixer over', () => {
    const p = trapProject();
    const kinds = Object.fromEntries(compileProject(p).channels.map((c) => [c.spec.id, c.spec.kind]));
    assert.deepEqual(kinds, { kick: 'drum', snare: 'drum', clap: 'drum', hat: 'drum', ohat: 'drum', bass: 'bass808', keys: 'poly' });
    const c = compileProject(trapProject({ channels: [drum('k', 'kick', { 0: 1 }, { mix: { db: -6, pan: 0.5, rev: 0.2, dly: 0.1, duck: 0, mute: true, solo: false } })] }));
    const m = (c.channels[0] as { mix: ChannelMix }).mix;
    assert.ok(Math.abs(m.gain - 10 ** (-6 / 20)) < 1e-9);
    assert.equal(m.pan, 0.5);
    assert.equal(m.mute, true);
  });

  it('feeds the 808 settings into the bass channel', () => {
    const c = compileProject(trapProject({ p808: { decay: 2, glide: 0.2, drive: 0.7 } }));
    const bass = c.channels.find((x) => x.spec.id === 'bass')?.spec;
    assert.deepEqual(bass && bass.kind === 'bass808' ? bass.params : null, { decay: 2, glide: 0.2, drive: 0.7 });
  });

  it('places drum steps on the 16th grid and the pattern length follows the bars', () => {
    const c = compileProject(trapProject({ bars: 2 }));
    assert.equal(c.pattern.lengthTicks, 2 * 4 * PPQ);
    const kicks = c.pattern.events.filter((e) => e.channel === 'kick').map((e) => e.tick / STEP_TICKS);
    assert.deepEqual(kicks, [0, 10, 16, 26]);
    const one = compileProject(trapProject({ bars: 1 }));
    assert.deepEqual(one.pattern.events.filter((e) => e.channel === 'kick').map((e) => e.tick / STEP_TICKS), [0, 10]);
  });

  it('turns a ratchet into evenly spaced hits that fit inside the step', () => {
    const c = compileProject(trapProject());
    const roll = c.pattern.events.filter((e) => e.channel === 'hat' && e.tick >= 14 * STEP_TICKS && e.tick < 15 * STEP_TICKS);
    assert.deepEqual(roll.map((e) => e.tick - 14 * STEP_TICKS), [0, 80, 160]);
    const v = roll.map((e) => e.velocity);
    assert.ok(v[0] !== undefined && v[2] !== undefined && v[0] < v[2], 'up-roll should rise');
    const four = c.pattern.events.filter((e) => e.channel === 'hat' && e.tick >= 30 * STEP_TICKS && e.tick < 31 * STEP_TICKS);
    assert.deepEqual(four.map((e) => e.tick - 30 * STEP_TICKS), [0, 60, 120, 180]);
  });

  it('converts piano-roll notes from steps to ticks, keeping slide and velocity', () => {
    const p = trapProject({ channels: [inst('b', 'sub', [[0.5, 1.5, 40, 0.6, true]])] });
    const e = compileProject(p).pattern.events[0];
    assert.deepEqual(e, { tick: STEP_TICKS / 2, durTicks: STEP_TICKS * 1.5, channel: 'b', note: 40, velocity: 0.6, slide: true });
  });

  it('humanise is deterministic and bounded; zero humanise is exact', () => {
    const a = compileProject(trapProject({ human: 0.8 }));
    const b = compileProject(trapProject({ human: 0.8 }));
    assert.deepEqual(a.pattern.events, b.pattern.events);
    const hats = a.pattern.events.filter((e) => e.channel === 'hat');
    assert.ok(new Set(hats.map((h) => h.velocity)).size > 4, 'no variation');
    assert.ok(hats.every((h) => h.velocity >= 0.05 && h.velocity <= 1));
    const exact = compileProject(trapProject({ human: 0 })).pattern.events.filter((e) => e.channel === 'kick');
    assert.deepEqual(exact.map((e) => e.velocity), [1, 0.9, 1, 0.85]);
  });

  it('ignores steps beyond the pattern length and survives a project with no channels', () => {
    const long = drum('k', 'kick', { 40: 1, 2: 1 }, {}, 64);
    assert.equal(compileProject(trapProject({ bars: 1, channels: [long] })).pattern.events.length, 1);
    assert.deepEqual(compileProject(trapProject({ channels: [] })).pattern.events, []);
  });
});
