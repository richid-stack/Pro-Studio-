import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FADER_MIN_DB, gridMove, dbToFader, faderToDb, formatDb, formatPan, meterPosition, speakDb, stepValue, valueFromDrag } from '../src/index';

describe('drag maths', () => {
  const r = { min: 0, max: 1 };
  it('a full-travel drag sweeps the range; fine mode is eight times slower', () => {
    assert.equal(valueFromDrag(0, 160, r), 1);
    assert.equal(valueFromDrag(0.5, 40, r), 0.75);
    assert.ok(Math.abs(valueFromDrag(0.5, 40, r, 160, true) - 0.53125) < 1e-12);
  });
  it('clamps and handles a downward drag', () => {
    assert.equal(valueFromDrag(0.9, 500, r), 1);
    assert.equal(valueFromDrag(0.1, -500, r), 0);
    assert.equal(valueFromDrag(0.5, -40, r), 0.25);
  });
  it('steps without floating-point noise', () => {
    let v = 0;
    for (let i = 0; i < 10; i++) v = stepValue(v, 1, 0.1, r);
    assert.equal(v, 1);
    assert.equal(stepValue(0.5, -100, 0.05, r), 0);
  });
});

describe('fader curve', () => {
  it('puts 0 dB at the usual unity position and round-trips', () => {
    assert.ok(Math.abs(dbToFader(0) - 0.78) < 1e-9);
    for (const db of [-60, -40, -24, -12, -6, -3, 0, 3, 6]) assert.ok(Math.abs(faderToDb(dbToFader(db)) - db) < 1e-6, `${db} dB`);
  });
  it('is monotonic over its whole travel and clamps its ends', () => {
    let prev = -Infinity;
    for (let p = 0; p <= 1; p += 0.005) {
      const d = faderToDb(p);
      assert.ok(d >= prev - 1e-12, `not monotonic at ${p}`);
      prev = d;
    }
    assert.equal(faderToDb(0), FADER_MIN_DB);
    assert.equal(faderToDb(1), 6);
    assert.equal(faderToDb(-3), FADER_MIN_DB);
    assert.equal(dbToFader(99), 1);
    assert.equal(dbToFader(-999), 0);
  });
  it('gives fine control near unity: a 1 dB move is a bigger slice of travel than at the bottom', () => {
    const near = dbToFader(0) - dbToFader(-1);
    const low = dbToFader(-49) - dbToFader(-50);
    assert.ok(near > low);
  });
});

describe('readouts', () => {
  it('formats dB, pan and meter positions', () => {
    assert.equal(formatDb(-60), '-inf');
    assert.equal(formatDb(0), '0.0');
    assert.equal(formatDb(3.04), '+3.0');
    assert.equal(formatDb(-6.26), '-6.3');
    assert.equal(formatPan(0), 'C');
    assert.equal(formatPan(-0.5), '50L');
    assert.equal(formatPan(1), '100R');
    assert.equal(meterPosition(0), 0);
    assert.equal(meterPosition(1), 1);
    assert.ok(Math.abs(meterPosition(0.5) - (60 - 6.0206) / 60) < 1e-3);
    assert.equal(meterPosition(4), 1);
  });
});

describe('gridMove', () => {
  it('moves one cell and stops at the edges', () => {
    assert.deepEqual(gridMove(1, 1, 'ArrowRight', 3, 16), { row: 1, col: 2 });
    assert.deepEqual(gridMove(0, 0, 'ArrowLeft', 3, 16), { row: 0, col: 0 });
    assert.deepEqual(gridMove(2, 15, 'ArrowRight', 3, 16), { row: 2, col: 15 });
    assert.deepEqual(gridMove(0, 4, 'ArrowUp', 3, 16), { row: 0, col: 4 });
    assert.deepEqual(gridMove(2, 4, 'ArrowDown', 3, 16), { row: 2, col: 4 });
    assert.deepEqual(gridMove(1, 7, 'Home', 3, 16), { row: 1, col: 0 });
    assert.deepEqual(gridMove(1, 7, 'End', 3, 16), { row: 1, col: 15 });
  });

  it('ignores other keys and survives an empty grid', () => {
    assert.equal(gridMove(0, 0, 'a', 3, 16), null);
    assert.deepEqual(gridMove(5, 99, 'ArrowDown', 0, 0), { row: 0, col: 0 });
  });
});

describe('speakDb', () => {
  it('says levels the way a person would', () => {
    assert.equal(speakDb(-4), 'minus 4 decibels');
    assert.equal(speakDb(-4.5), 'minus 4.5 decibels');
    assert.equal(speakDb(2), 'plus 2 decibels');
    assert.equal(speakDb(1), 'plus 1 decibel');
    assert.equal(speakDb(0), '0 decibels');
    assert.equal(speakDb(0.04), '0 decibels');
    assert.equal(speakDb(-60), 'silent');
  });
});
