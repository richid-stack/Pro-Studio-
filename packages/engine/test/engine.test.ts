import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Engine, peak, rms, type TimedEvent } from '../src/index';
import { SR } from './synth';

const hit = (channel: string, offset = 0, note = 60, velocity = 1): TimedEvent => ({ offset, event: { type: 'noteOn', channel, note, velocity } });

function run(engine: Engine, seconds: number, events: TimedEvent[] = []): { l: Float32Array; r: Float32Array } {
  const n = Math.floor(seconds * SR);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  engine.process(l, r, n, events);
  return { l, r };
}

describe('mixer', () => {
  it('pans hard left and right with nothing leaking, and centre is equal in both', () => {
    for (const [pan, silent] of [[-1, 'r'], [1, 'l']] as const) {
      const e = new Engine(SR);
      e.addChannel({ id: 'k', kind: 'drum', drum: 'kick' }, { pan });
      const out = run(e, 0.3, [hit('k')]);
      assert.equal(peak(out[silent]), 0, `${silent} should be silent at pan ${pan}`);
      assert.ok(peak(out[silent === 'l' ? 'r' : 'l']) > 0.3);
    }
    const e = new Engine(SR);
    e.addChannel({ id: 'k', kind: 'drum', drum: 'kick' });
    const { l, r } = run(e, 0.3, [hit('k')]);
    assert.deepEqual(l, r);
  });

  it('gain scales level linearly', () => {
    const level = (gain: number) => {
      const e = new Engine(SR);
      e.addChannel({ id: 'k', kind: 'drum', drum: 'kick' }, { gain });
      return peak(run(e, 0.3, [hit('k')]).l);
    };
    assert.ok(Math.abs(level(0.5) / level(0.25) - 2) < 0.02);
  });

  it('mute silences, solo isolates, and mute beats solo', () => {
    const make = (a: object, b: object) => {
      const e = new Engine(SR);
      e.addChannel({ id: 'k', kind: 'drum', drum: 'kick' }, a);
      e.addChannel({ id: 'h', kind: 'drum', drum: 'hat' }, b);
      return e;
    };
    const both = [hit('k'), hit('h')];
    assert.equal(peak(run(make({ mute: true }, { mute: true }), 0.3, both).l), 0);
    // soloing the hat leaves no kick body: sub energy vanishes
    const solo = run(make({}, { solo: true }), 0.3, both).l;
    const open = run(make({}, {}), 0.3, both).l;
    assert.ok(rms(solo) < rms(open) * 0.5);
    assert.equal(peak(run(make({}, { solo: true, mute: true }), 0.3, [hit('h')]).l), 0);
  });

  it('a gain change glides, so moving a fader does not click', () => {
    const e = new Engine(SR);
    e.addChannel({ id: 'o', kind: 'poly', preset: 'organ' }, { gain: 1 });
    const n = SR / 2;
    const l = new Float32Array(n);
    const r = new Float32Array(n);
    e.process(l.subarray(0, 4410), r.subarray(0, 4410), 4410, [hit('o', 0, 57)]);
    e.setMix('o', { gain: 0 });
    e.process(l.subarray(4410, 8820), r.subarray(4410, 8820), 4410);
    let worst = 0;
    for (let i = 4400; i < 8800; i++) worst = Math.max(worst, Math.abs((l[i] as number) - (l[i - 1] as number)));
    assert.ok(worst < 0.05, `step ${worst}`);
    assert.ok(peak(l, 8000, 8820) < 0.01, 'fader did not reach zero');
  });

  it('ignores non-finite values from the UI', () => {
    const e = new Engine(SR);
    e.addChannel({ id: 'k', kind: 'drum', drum: 'kick' });
    e.setMix('k', { gain: Number.NaN, pan: Number.POSITIVE_INFINITY });
    const out = run(e, 0.3, [hit('k')]);
    assert.ok(out.l.every(Number.isFinite) && peak(out.l) > 0.3);
    assert.equal(e.nonFiniteSamples, 0);
  });
});

describe('master bus', () => {
  it('never exceeds 0.98 and stays finite, however much is piled on', () => {
    const e = new Engine(SR);
    for (let i = 0; i < 16; i++) e.addChannel({ id: `k${i}`, kind: 'drum', drum: 'kick' }, { gain: 1.5 });
    e.masterGain = 1.5;
    const out = run(e, 0.5, Array.from({ length: 16 }, (_, i) => hit(`k${i}`)));
    assert.ok(peak(out.l) <= 0.98 + 1e-6 && peak(out.l) > 0.9, `peak ${peak(out.l)}`);
    assert.ok(out.l.every(Number.isFinite) && out.r.every(Number.isFinite));
    assert.equal(e.nonFiniteSamples, 0);
  });

  it('is transparent at normal levels', () => {
    const e = new Engine(SR);
    e.addChannel({ id: 'k', kind: 'drum', drum: 'kick' }, { gain: 0.5 });
    e.masterGain = 1;
    const out = run(e, 0.3, [hit('k')]);
    // pan law puts a centred mono source at cos(pi/4) per side; gain 0.5; kick peak 0.95
    assert.ok(Math.abs(peak(out.l) - 0.95 * 0.5 * Math.SQRT1_2) < 0.01);
  });
});

describe('event timing', () => {
  it('starts a note on exactly the requested frame', () => {
    for (const offset of [0, 1, 100, 441, 2047, 5000]) {
      const e = new Engine(SR);
      e.addChannel({ id: 'k', kind: 'drum', drum: 'kick' }, { gain: 1 });
      const { l } = run(e, 0.2, [hit('k', offset)]);
      const first = l.findIndex((x) => x !== 0);
      assert.equal(first, offset, `offset ${offset}`);
    }
  });

  it('gives the same audio whether a block is rendered whole or in pieces', () => {
    const events = [hit('k', 10), hit('h', 700), hit('k', 1500), hit('h', 3001)];
    const make = () => {
      const e = new Engine(SR);
      e.addChannel({ id: 'k', kind: 'drum', drum: 'kick' }, { rev: 0.4, dly: 0.3 });
      e.addChannel({ id: 'h', kind: 'drum', drum: 'hat' }, { pan: 0.4, duck: 0.8 });
      return e;
    };
    const whole = run(make(), 0.3, events);
    const e = make();
    const n = Math.floor(0.3 * SR);
    const l = new Float32Array(n);
    const r = new Float32Array(n);
    for (let pos = 0; pos < n; pos += 333) {
      const end = Math.min(n, pos + 333);
      const ev = events.filter((x) => x.offset >= pos && x.offset < end).map((x) => ({ ...x, offset: x.offset - pos }));
      e.process(l.subarray(pos, end), r.subarray(pos, end), end - pos, ev);
    }
    assert.deepEqual(l, whole.l);
    assert.deepEqual(r, whole.r);
  });

  it('ignores events for channels that do not exist', () => {
    const e = new Engine(SR);
    assert.doesNotThrow(() => run(e, 0.1, [hit('ghost'), { offset: 0, event: { type: 'noteOff', channel: 'ghost', note: 1 } }]));
  });
});

describe('effects and dynamics', () => {
  it('reverb send adds a tail that dies away', () => {
    const tail = (rev: number) => {
      const e = new Engine(SR);
      e.addChannel({ id: 'h', kind: 'drum', drum: 'hat' }, { rev });
      return run(e, 3, [hit('h')]).l;
    };
    const dry = tail(0);
    const wet = tail(1);
    assert.ok(peak(dry, Math.floor(0.6 * SR)) < 1e-6, 'dry hat should be over by 0.6 s');
    assert.ok(rms(wet, Math.floor(0.5 * SR), Math.floor(0.8 * SR)) > 1e-3, 'no reverb tail');
    assert.ok(rms(wet, Math.floor(2.5 * SR)) < rms(wet, Math.floor(0.5 * SR), Math.floor(0.8 * SR)) * 0.5, 'reverb does not decay');
    assert.ok(wet.every(Number.isFinite));
  });

  it('delay send repeats the sound at the delay time', () => {
    const e = new Engine(SR);
    e.addChannel({ id: 'h', kind: 'drum', drum: 'hat' }, { dly: 1 });
    e.setDelayTime(0.4);
    const { l } = run(e, 1.5, [hit('h')]);
    const at = (t: number) => rms(l, Math.floor(t * SR), Math.floor((t + 0.05) * SR));
    assert.ok(at(0.4) > at(0.25) * 20, 'no echo at 0.4 s');
    assert.ok(at(0.8) > at(0.6) * 10, 'no second echo');
    assert.ok(at(0.8) < at(0.4), 'echo does not fade');
  });

  it('the kick ducks channels that ask for it, even when the kick itself is muted', () => {
    const level = (duck: number) => {
      const e = new Engine(SR);
      e.addChannel({ id: 'k', kind: 'drum', drum: 'kick' }, { mute: true });
      e.addChannel({ id: 'o', kind: 'poly', preset: 'organ' }, { gain: 1, duck });
      e.process(new Float32Array(2205), new Float32Array(2205), 2205, [{ offset: 0, event: { type: 'noteOn', channel: 'o', note: 57, velocity: 1 } }]);
      const { l } = run(e, 0.6, [hit('k', 11025)]);
      return { dip: rms(l, 11025 + 100, 11025 + 600), later: rms(l, Math.floor(0.55 * SR)), before: rms(l, 8000, 11000) };
    };
    const off = level(0);
    const on = level(1);
    assert.ok(on.dip < on.before * 0.4, `duck did not dip: ${on.dip} vs ${on.before}`);
    assert.ok(Math.abs(off.dip / off.before - 1) < 0.2, 'no duck: level should be steady');
    assert.ok(on.later > on.before * 0.8, 'duck did not recover');
  });

  it('a closed hat chokes an open hat', () => {
    const tail = (chokeAt: number | null) => {
      const e = new Engine(SR);
      e.addChannel({ id: 'o', kind: 'drum', drum: 'ohat' });
      e.addChannel({ id: 'h', kind: 'drum', drum: 'hat' });
      const ev = [hit('o', 0), ...(chokeAt === null ? [] : [hit('h', Math.floor(chokeAt * SR))])];
      return rms(run(e, 0.8, ev).l, Math.floor(0.45 * SR), Math.floor(0.7 * SR));
    };
    assert.ok(tail(0.1) < tail(null) * 0.2);
  });
});

describe('channel management', () => {
  it('removing a channel silences it; replacing a channel starts fresh', () => {
    const e = new Engine(SR);
    e.addChannel({ id: 'o', kind: 'drum', drum: 'ohat' });
    e.process(new Float32Array(1000), new Float32Array(1000), 1000, [hit('o')]);
    e.removeChannel('o');
    assert.equal(peak(run(e, 0.2).l), 0);
    assert.deepEqual(e.channelIds, []);
    e.addChannel({ id: 'a', kind: 'poly', preset: 'pluck' });
    e.addChannel({ id: 'a', kind: 'drum', drum: 'kick' });
    assert.equal(e.channelIds.length, 1);
  });

  it('meters report the peak since the last read, then reset', () => {
    const e = new Engine(SR);
    e.addChannel({ id: 'k', kind: 'drum', drum: 'kick' }, { gain: 0.5 });
    run(e, 0.3, [hit('k')]);
    const m = e.readMeters();
    assert.ok((m.channels.k as number) > 0.3 && m.masterL > 0.2 && m.masterR > 0.2);
    const again = e.readMeters();
    assert.equal(again.channels.k, 0);
    assert.equal(again.masterL, 0);
  });

  it('counts voices across channels', () => {
    const e = new Engine(SR);
    e.addChannel({ id: 'a', kind: 'poly', preset: 'pad' });
    e.addChannel({ id: 'b', kind: 'drum', drum: 'snare' });
    run(e, 0.05, [hit('a', 0, 60), hit('a', 0, 64), hit('b', 0)]);
    assert.equal(e.voiceCount, 3);
  });
});
