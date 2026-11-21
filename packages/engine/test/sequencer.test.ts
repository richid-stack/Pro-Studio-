import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PPQ, STEP_TICKS } from '@pro-studio/shared';
import { Sequencer, type EngineEvent, type Pattern } from '../src/index';
import { SR } from './synth';

interface Got {
  frame: number;
  event: EngineEvent;
}

/** Collect every event over `seconds`, as absolute frames, using a given block size. */
function collect(seq: Sequencer, seconds: number, block: number): Got[] {
  const out: Got[] = [];
  const total = Math.floor(seconds * SR);
  for (let pos = 0; pos < total; pos += block) {
    const n = Math.min(block, total - pos);
    for (const e of seq.advance(n)) out.push({ frame: pos + e.offset, event: e.event });
  }
  return out;
}

const hit = (tick: number, ch = 'k', note = 60, durTicks = 100): Pattern['events'][number] => ({ tick, durTicks, channel: ch, note, velocity: 1 });
const ons = (g: Got[]) => g.filter((x) => x.event.type === 'noteOn');
const make = (events: Pattern['events'], bars = 1, bpm = 120, swing = 0): Sequencer => {
  const s = new Sequencer(SR);
  s.setTempo(bpm);
  s.setSwing(swing);
  s.setPattern({ lengthTicks: bars * 4 * PPQ, events });
  s.play();
  return s;
};

describe('Sequencer timing', () => {
  it('puts notes on the exact frame for the tempo (120 BPM: a beat is 22050 frames)', () => {
    const got = ons(collect(make([hit(0), hit(PPQ), hit(2 * PPQ)]), 1.6, 128));
    assert.deepEqual(got.slice(0, 3).map((g) => g.frame), [0, 22050, 44100]);
  });

  it('does not drift: the 1000th loop lands exactly where the formula says', () => {
    const bpm = 93;
    const fpt = (SR * 60) / (bpm * PPQ);
    const s = make([hit(0), hit(PPQ * 2 + 17)], 1, bpm);
    const seconds = (1000 * 4 * 60) / bpm;
    const got = ons(collect(s, seconds, 4096));
    assert.equal(got.length, 2000);
    for (const k of [0, 1, 500, 999]) {
      assert.equal((got[2 * k] as Got).frame, Math.round(k * 4 * PPQ * fpt), `loop ${k} first`);
      assert.equal((got[2 * k + 1] as Got).frame, Math.round((k * 4 * PPQ + PPQ * 2 + 17) * fpt), `loop ${k} second`);
    }
  });

  it('is identical for every block size, one frame at a time included', () => {
    const events = [hit(0), hit(STEP_TICKS), hit(480, 'h'), hit(1000, 'h', 62, 400), hit(3000, 'b', 36, 900), hit(3839)];
    const ref = collect(make(events, 1, 140, 0.4), 4, 128);
    assert.ok(ref.length > 20);
    for (const block of [1, 7, 64, 333, 1000, 4096, 50000]) assert.deepEqual(collect(make(events, 1, 140, 0.4), 4, block), ref, `block ${block}`);
  });

  it('plays every event exactly once', () => {
    const events = Array.from({ length: 16 }, (_, i) => hit(i * STEP_TICKS, 'h', 60 + i));
    const got = ons(collect(make(events, 1, 150), 2 * (240 / 150) + 0.01, 211));
    const counts = new Map<number, number>();
    for (const g of got) counts.set((g.event as { note: number }).note, (counts.get((g.event as { note: number }).note) ?? 0) + 1);
    assert.equal(counts.size, 16);
    for (const c of counts.values()) assert.ok(c === 2 || c === 3, `count ${c}`);
  });

  it('swing delays the off-beat 16th and leaves the on-beat alone', () => {
    const fpt = (SR * 60) / (120 * PPQ);
    const got = ons(collect(make([hit(0), hit(STEP_TICKS), hit(2 * STEP_TICKS), hit(3 * STEP_TICKS)], 1, 120, 1), 1, 128));
    const frames = got.slice(0, 4).map((g) => g.frame);
    assert.equal(frames[0], 0);
    assert.equal(frames[1], Math.round(1.5 * STEP_TICKS * fpt));
    assert.equal(frames[2], Math.round(2 * STEP_TICKS * fpt));
    assert.equal(frames[3], Math.round(3.5 * STEP_TICKS * fpt));
  });

  it('releases a note before retriggering the same note on the next step', () => {
    const got = collect(make([hit(0, 'b', 36, STEP_TICKS), hit(STEP_TICKS, 'b', 36, STEP_TICKS)]), 0.5, 128);
    const seq = got.map((g) => `${g.event.type}@${g.frame}`);
    const boundary = Math.round(STEP_TICKS * ((SR * 60) / (120 * PPQ)));
    assert.deepEqual(seq.slice(0, 4), ['noteOn@0', `noteOff@${boundary}`, `noteOn@${boundary}`, `noteOff@${Math.round(2 * STEP_TICKS * ((SR * 60) / (120 * PPQ)))}`]);
  });

  it('cuts a note that would outlast the loop at the loop end', () => {
    const got = collect(make([hit(3 * PPQ, 'b', 36, 4 * PPQ)]), 2.01, 128);
    const off = got.find((g) => g.event.type === 'noteOff') as Got;
    assert.equal(off.frame, 4 * 22050);
  });

  it('ignores events outside the pattern', () => {
    assert.equal(ons(collect(make([hit(-5), hit(4 * PPQ), hit(PPQ)]), 1.9, 128)).length, 1);
  });
});

describe('Sequencer transport', () => {
  it('pause freezes the position and resumes without losing or repeating anything', () => {
    const s = make([hit(0), hit(PPQ), hit(2 * PPQ)]);
    const a = collect(s, 0.6, 128);
    s.pause();
    const pos = s.positionTicks;
    assert.equal(collect(s, 5, 128).length, 0);
    assert.equal(s.positionTicks, pos);
    s.play();
    const b = collect(s, 1.2, 128).filter((g) => g.event.type === 'noteOn');
    assert.deepEqual(ons(a).length, 2);
    assert.equal(b.length, 1, 'only the remaining beat');
  });

  it('stop rewinds, so the next play starts with the first note', () => {
    const s = make([hit(0), hit(PPQ)]);
    collect(s, 0.7, 128);
    s.stop();
    assert.equal(s.positionTicks, 0);
    s.play();
    assert.equal((ons(collect(s, 0.1, 128))[0] as Got).frame, 0);
  });

  it('seek jumps to a position', () => {
    const s = make([hit(0), hit(PPQ, 'k', 61), hit(2 * PPQ, 'k', 62)]);
    s.seek(PPQ + 1);
    const notes = ons(collect(s, 0.6, 128)).map((g) => (g.event as { note: number }).note);
    assert.deepEqual(notes, [62]);
  });

  it('a tempo change keeps the position continuous and changes the spacing after it', () => {
    const s = make(Array.from({ length: 8 }, (_, i) => hit(i * PPQ / 2)), 1, 120);
    collect(s, 0.3, 128);
    const before = s.positionTicks;
    s.setTempo(60);
    assert.ok(Math.abs(s.positionTicks - before) < 1e-6);
    const got = ons(collect(s, 3, 128));
    const gaps = got.slice(1, 4).map((g, i) => g.frame - (got[i] as Got).frame);
    for (const gap of gaps) assert.ok(Math.abs(gap - 22050) <= 1, `gap ${gap} at 60 BPM, half a beat apart`);
  });

  it('replacing the pattern while playing keeps the playhead and neither repeats nor skips', () => {
    const s = make([hit(0), hit(PPQ)]);
    const a = collect(s, 0.3, 128);
    assert.equal(ons(a).length, 1);
    s.setPattern({ lengthTicks: 4 * PPQ, events: [hit(0), hit(PPQ), hit(2 * PPQ, 'k', 70)] });
    const b = ons(collect(s, 1.1, 128)).map((g) => (g.event as { note: number }).note);
    assert.deepEqual(b, [60, 70]);
  });

  it('survives an empty pattern, a huge block and a zero-length request', () => {
    const s = make([]);
    assert.deepEqual(collect(s, 1, 100000), []);
    assert.deepEqual(s.advance(0), []);
  });

  it('clamps absurd tempo and swing', () => {
    const s = new Sequencer(SR);
    s.setTempo(1e9);
    s.setSwing(9);
    assert.equal(s.bpm, 400);
    assert.equal(s.swing, 1);
    s.setTempo(-5);
    assert.equal(s.bpm, 20);
  });
});
