import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PPQ } from '@pro-studio/shared';
import { detectOnsets, EngineHost, peak, renderOffline, type HostCommand, type HostTelemetry } from '../src/index';
import { trapProject } from './fixtures';
import { SR, sine } from './synth';

const kickLoop = (bpm = 120): HostCommand[] => [
  { type: 'addChannel', spec: { id: 'k', kind: 'drum', drum: 'kick' }, mix: { gain: 1 } },
  { type: 'setPattern', pattern: { lengthTicks: 4 * PPQ, events: [0, PPQ, 2 * PPQ, 3 * PPQ].map((tick) => ({ tick, durTicks: 100, channel: 'k', note: 60, velocity: 1 })) } },
  { type: 'setTempo', bpm },
  { type: 'play' },
];

describe('EngineHost', () => {
  it('plays a pattern at the right tempo: kicks land on the beat within 10 ms', () => {
    const { left } = renderOffline({ seconds: 2.4, commands: kickLoop(120) });
    const cuts = detectOnsets(left, SR, { sensitivity: 0.6, maxCuts: 16 });
    assert.equal(cuts.length, 5, `onsets at ${cuts.map((c) => c.toFixed(3)).join(' ')}`);
    cuts.forEach((c, i) => assert.ok(Math.abs(c - i * 0.5) < 0.01, `onset ${i} at ${c}`));
  });

  it('is silent until play, and silent again after stop', () => {
    const idle = renderOffline({ seconds: 0.5, commands: kickLoop().slice(0, 3) });
    assert.equal(peak(idle.left), 0);
    const stopped = renderOffline({ seconds: 1.5, commands: kickLoop(), timed: [{ atSeconds: 0.7, command: { type: 'stop' } }] });
    assert.ok(peak(stopped.left, Math.floor(0.9 * SR)) < 1e-3, 'sound after stop');
  });

  it('resumes after pause from where it was, and stop followed by play starts again from the top', () => {
    const r = renderOffline({
      seconds: 3,
      commands: kickLoop(),
      timed: [{ atSeconds: 0.7, command: { type: 'pause' } }, { atSeconds: 1.5, command: { type: 'play' } }],
    });
    const cuts = detectOnsets(r.left, SR, { sensitivity: 0.6, maxCuts: 16 });
    // kicks at 0, 0.5; paused over 0.7–1.5; resumes with the 1.0 s kick due 0.3 s later -> 1.8, then 2.3, 2.8
    const expected = [0, 0.5, 1.8, 2.3, 2.8];
    assert.equal(cuts.length, expected.length, `onsets ${cuts.map((c) => c.toFixed(3)).join(' ')}`);
    cuts.forEach((c, i) => assert.ok(Math.abs(c - (expected[i] as number)) < 0.015, `onset ${i}: ${c} vs ${expected[i]}`));
  });

  it('plays live notes on the first frame, and releases them', () => {
    const r = renderOffline({
      seconds: 1,
      commands: [{ type: 'addChannel', spec: { id: 'o', kind: 'poly', preset: 'organ' }, mix: { gain: 1 } }, { type: 'noteOn', channel: 'o', note: 60, velocity: 1 }],
      timed: [{ atSeconds: 0.4, command: { type: 'noteOff', channel: 'o', note: 60 } }],
    });
    assert.ok(r.left.findIndex((x) => x !== 0) < 128, 'live note was late');
    assert.ok(peak(r.left, Math.floor(0.3 * SR), Math.floor(0.4 * SR)) > 0.05);
    assert.ok(peak(r.left, Math.floor(0.9 * SR)) < 1e-3);
  });

  it('sets up a whole project from one command', () => {
    const r = renderOffline({ seconds: 3.5, commands: [{ type: 'setProject', project: trapProject() }, { type: 'play' }] });
    assert.ok(r.left.every(Number.isFinite) && r.right.every(Number.isFinite));
    assert.ok(peak(r.left) > 0.3 && peak(r.left) <= 0.98 + 1e-6);
    assert.equal(r.host.sequencer.bpm, 140);
    assert.deepEqual([...r.host.engine.channelIds].sort(), ['bass', 'clap', 'hat', 'keys', 'kick', 'ohat', 'snare']);
    assert.equal(r.host.engine.nonFiniteSamples, 0);
  });

  it('re-sending an unchanged project mid-playback changes nothing (diffed, not rebuilt)', () => {
    const cmds: HostCommand[] = [{ type: 'setProject', project: trapProject() }, { type: 'play' }];
    const plain = renderOffline({ seconds: 2, commands: cmds });
    const resent = renderOffline({ seconds: 2, commands: cmds, timed: [0.31, 0.77, 1.3].map((t) => ({ atSeconds: t, command: { type: 'setProject', project: trapProject() } as HostCommand })) });
    assert.deepEqual(resent.left, plain.left);
    assert.deepEqual(resent.right, plain.right);
  });

  it('drops channels that are no longer in the project and keeps the rest sounding', () => {
    const p = trapProject();
    const r = renderOffline({
      seconds: 1,
      commands: [{ type: 'setProject', project: p }, { type: 'play' }],
      timed: [{ atSeconds: 0.5, command: { type: 'setProject', project: { ...p, channels: p.channels.filter((c) => c.id !== 'keys' && c.id !== 'hat') } } }],
    });
    assert.deepEqual([...r.host.engine.channelIds].sort(), ['bass', 'clap', 'kick', 'ohat', 'snare']);
    assert.ok(peak(r.left, Math.floor(0.6 * SR)) > 0.1);
  });

  it('produces the same audio for any block size, with every effect and instrument in play', () => {
    const project = trapProject({
      swing: 0.35,
      human: 0.4,
      channels: trapProject().channels.map((c, i) => ({ ...c, mix: { ...c.mix, rev: i % 2 ? 0.3 : 0, dly: i % 3 === 0 ? 0.25 : 0, duck: i >= 5 ? 0.7 : 0, pan: (i - 3) * 0.2 } })),
    });
    const cmds: HostCommand[] = [{ type: 'setProject', project }, { type: 'play' }];
    const ref = renderOffline({ seconds: 1.3, commands: cmds, blockSize: 128 });
    for (const blockSize of [1, 77, 1024, 4096, 20000]) {
      const r = renderOffline({ seconds: 1.3, commands: cmds, blockSize });
      assert.deepEqual(r.left, ref.left, `left differs at block size ${blockSize}`);
      assert.deepEqual(r.right, ref.right, `right differs at block size ${blockSize}`);
    }
  });

  it('plays a loaded sample', () => {
    const r = renderOffline({
      seconds: 0.5,
      commands: [
        { type: 'addChannel', spec: { id: 's', kind: 'sampler', params: { rootNote: 69 } }, mix: { gain: 1 } },
        { type: 'loadSample', id: 's', data: { channels: [sine(440, 1)], sampleRate: SR } },
        { type: 'noteOn', channel: 's', note: 69, velocity: 1 },
      ],
    });
    assert.ok(peak(r.left) > 0.3);
  });

  it('shrugs off commands for things that do not exist', () => {
    assert.doesNotThrow(() =>
      renderOffline({
        seconds: 0.1,
        commands: [
          { type: 'setMix', id: 'nope', mix: { gain: 1 } },
          { type: 'setParams', id: 'nope', params: { decay: 1 } },
          { type: 'loadSample', id: 'nope', data: null },
          { type: 'removeChannel', id: 'nope' },
          { type: 'noteOn', channel: 'nope', note: 60, velocity: 1 },
          { type: 'seek', tick: 1e9 },
          { type: 'play' },
        ],
      }),
    );
  });

  it('reports position and meters about thirty times a second', () => {
    const host = new EngineHost(SR);
    for (const c of kickLoop()) host.handle(c);
    const l = new Float32Array(128);
    const r = new Float32Array(128);
    const got: HostTelemetry[] = [];
    for (let i = 0; i < Math.floor(SR / 128); i++) {
      host.process(l, r);
      got.push(...host.takeTelemetry());
    }
    const positions = got.filter((t): t is Extract<HostTelemetry, { type: 'position' }> => t.type === 'position');
    assert.ok(positions.length >= 28 && positions.length <= 32, `${positions.length} position updates per second`);
    assert.ok(positions.every((p, i) => i === 0 || p.tick > (positions[i - 1] as { tick: number }).tick));
    assert.ok(positions.every((p) => p.playing));
    const meters = got.filter((t): t is Extract<HostTelemetry, { type: 'meters' }> => t.type === 'meters');
    assert.ok(meters.some((m) => m.meters.masterL > 0.3));
    assert.equal(host.takeTelemetry().length, 0);
  });
});
