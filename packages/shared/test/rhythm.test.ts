import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildRoll, PPQ, ROLL_DIVISIONS, STEP_TICKS, swingTick } from '../src/rhythm';

describe('swingTick', () => {
  it('is the identity with no swing', () => {
    for (const t of [0, 1, 240, 360, 479, 480, 12345]) assert.equal(swingTick(t, 0), t);
  });

  it('never moves a pair boundary (every 8th note stays on the grid)', () => {
    for (const s of [0.1, 0.5, 1]) for (let k = 0; k < 8; k++) assert.equal(swingTick(k * 2 * STEP_TICKS, s), k * 2 * STEP_TICKS);
  });

  it('delays the off-beat 16th by a quarter of a step per unit of swing', () => {
    assert.equal(swingTick(STEP_TICKS, 1), STEP_TICKS * 1.5);
    assert.equal(swingTick(STEP_TICKS, 0.5), STEP_TICKS * 1.25);
    assert.equal(swingTick(STEP_TICKS + 2 * STEP_TICKS, 1), 3 * STEP_TICKS + STEP_TICKS * 0.5);
  });

  it('is strictly monotonic so note order is preserved', () => {
    for (const s of [0.2, 0.66, 1]) {
      let prev = -1;
      for (let t = 0; t <= PPQ * 2; t += 7) {
        const v = swingTick(t, s);
        assert.ok(v > prev, `swing ${s}: tick ${t} -> ${v} not after ${prev}`);
        prev = v;
      }
    }
  });

  it('clamps out-of-range swing', () => {
    assert.equal(swingTick(STEP_TICKS, 5), swingTick(STEP_TICKS, 1));
    assert.equal(swingTick(STEP_TICKS, -2), STEP_TICKS);
  });
});

describe('buildRoll', () => {
  it('spreads hits evenly: triplets and 64ths fall on whole ticks', () => {
    assert.deepEqual(buildRoll({ startTick: 0, lengthTicks: STEP_TICKS, hits: 3 }).map((h) => h.tick), [0, 80, 160]);
    assert.deepEqual(buildRoll({ startTick: 960, lengthTicks: STEP_TICKS, hits: 4 }).map((h) => h.tick), [960, 1020, 1080, 1140]);
    for (const d of ROLL_DIVISIONS) {
      const ticks = buildRoll({ startTick: 0, lengthTicks: STEP_TICKS, hits: d }).map((h) => h.tick);
      assert.equal(ticks.length, d);
      assert.ok(ticks.every((t) => Number.isInteger(t) && t >= 0 && t < STEP_TICKS));
    }
  });

  it('shapes velocity: up rises, down falls, updown peaks in the middle, flat is constant', () => {
    const v = (shape: 'flat' | 'up' | 'down' | 'updown') => buildRoll({ startTick: 0, lengthTicks: 240, hits: 5, shape, velocity: 1, minVelocity: 0.2 }).map((h) => h.velocity);
    assert.deepEqual(v('flat'), [1, 1, 1, 1, 1]);
    const up = v('up');
    assert.ok(up.every((x, i) => i === 0 || x > (up[i - 1] as number)));
    assert.equal(up[0], 0.2);
    assert.equal(up[4], 1);
    const down = v('down');
    assert.ok(down.every((x, i) => i === 0 || x < (down[i - 1] as number)));
    const ud = v('updown');
    assert.equal(ud[2], 1);
    assert.equal(ud[0], ud[4]);
  });

  it('humanize is deterministic for a seed, bounded, and different across seeds', () => {
    const a = buildRoll({ startTick: 0, lengthTicks: 240, hits: 8, humanize: 1, seed: 7 });
    const b = buildRoll({ startTick: 0, lengthTicks: 240, hits: 8, humanize: 1, seed: 7 });
    const c = buildRoll({ startTick: 0, lengthTicks: 240, hits: 8, humanize: 1, seed: 8 });
    assert.deepEqual(a, b);
    assert.notDeepEqual(a, c);
    assert.ok(a.every((h) => h.velocity >= 0.05 && h.velocity <= 1));
  });

  it('a single hit is a normal hit and bad input is clamped', () => {
    assert.deepEqual(buildRoll({ startTick: 100, lengthTicks: 240, hits: 1, velocity: 0.8 }), [{ tick: 100, velocity: 0.8 }]);
    assert.equal(buildRoll({ startTick: 0, lengthTicks: 240, hits: 0 }).length, 1);
    assert.equal(buildRoll({ startTick: 0, lengthTicks: 240, hits: 2, velocity: 9 })[0]?.velocity, 1);
  });
});
