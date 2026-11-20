import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROGRESSIONS,
  SCALES,
  buildChord,
  detectChord,
  diatonicChord,
  isInScale,
  midiName,
  mtof,
  prefersFlats,
  realizeProgression,
  scaleDegreeOf,
  snapToScale,
  type ChordType,
  type Genre,
  type ScaleId,
} from '../src/index';

test('midiName uses C4 = 60 and can spell with flats', () => {
  assert.equal(midiName(60), 'C4');
  assert.equal(midiName(69), 'A4');
  assert.equal(midiName(46, true), 'Bb2');
  assert.equal(midiName(46), 'A#2');
  assert.equal(midiName(-1), 'B-2');
});

test('mtof: A4 is 440 Hz and an octave doubles', () => {
  assert.equal(mtof(69), 440);
  assert.ok(Math.abs(mtof(81) - 880) < 1e-9);
});

test('scale membership and degrees (F minor)', () => {
  const F = 5;
  assert.ok(isInScale(53, F, 'minor')); // F3
  assert.ok(isInScale(56, F, 'minor')); // Ab3
  assert.ok(!isInScale(54, F, 'minor')); // F#3
  assert.equal(scaleDegreeOf(60, F, 'minor'), 4); // C is the 5th
  assert.equal(scaleDegreeOf(54, F, 'minor'), null);
});

test('snapToScale picks the nearest in-scale note, lower on ties', () => {
  // C major: C#4 (61) sits between C (60) and D (62): tie goes down.
  assert.equal(snapToScale(61, 0, 'major'), 60);
  assert.equal(snapToScale(60, 0, 'major'), 60);
  // Every result is in the scale for every scale and every starting note.
  for (const id of Object.keys(SCALES) as ScaleId[]) {
    for (let m = 36; m < 96; m++) assert.ok(isInScale(snapToScale(m, 7, id), 7, id), `${id} ${m}`);
  }
});

test('buildChord and inversions', () => {
  assert.deepEqual(buildChord(60, 'maj'), [60, 64, 67]);
  assert.deepEqual(buildChord(60, 'maj', 1), [64, 67, 72]);
  assert.deepEqual(buildChord(60, 'maj', 2), [67, 72, 76]);
  assert.deepEqual(buildChord(60, 'min7'), [60, 63, 67, 70]);
});

test('detectChord names chords in any voicing', () => {
  assert.equal(detectChord([60, 64, 67])?.symbol, 'C');
  assert.equal(detectChord([64, 67, 72])?.symbol, 'C/E');
  assert.equal(detectChord([69, 72, 76, 79])?.symbol, 'Am7');
  assert.equal(detectChord([46, 50, 53, 56], true)?.symbol, 'Bb7');
  assert.equal(detectChord([60, 62])?.symbol, undefined); // two notes are not a chord
  assert.equal(detectChord([60, 61, 62]), null);
});

test('every chord type round-trips through buildChord and detectChord', () => {
  const types: ChordType[] = ['maj', 'min', 'dim', 'aug', 'sus2', 'sus4', 'maj7', 'min7', 'dom7', 'm7b5', 'maj9', 'min9', 'dom9'];
  for (const type of types) {
    const found = detectChord(buildChord(48, type));
    assert.ok(found, type);
    assert.equal(found.type, type, `${type} detected as ${found.type}`);
    assert.equal(found.rootPc, 0);
  }
});

test('diatonicChord stacks thirds inside the key', () => {
  // C natural minor: i = Cm, VI = Ab, VII = Bb
  assert.deepEqual(diatonicChord(48, 'minor', 0), [48, 51, 55]);
  assert.deepEqual(diatonicChord(48, 'minor', 5), [56, 60, 63]);
  assert.equal(detectChord(diatonicChord(48, 'minor', 6, 'seventh') ?? [], true)?.symbol, 'Bb7');
  assert.equal(diatonicChord(48, 'minorPentatonic', 0), null);
});

test('flat keys are spelled with flats', () => {
  assert.ok(prefersFlats(5, 'minor')); // F minor -> Ab major
  assert.ok(prefersFlats(0, 'minor')); // C minor -> Eb major
  assert.ok(!prefersFlats(9, 'minor')); // A minor -> C major
  assert.ok(prefersFlats(5, 'major')); // F major
  assert.ok(!prefersFlats(7, 'major')); // G major
});

test('trap progression in F minor realizes to the expected chords', () => {
  const prog = PROGRESSIONS.trap[0];
  assert.ok(prog);
  const chords = realizeProgression(prog, 5);
  assert.deepEqual(chords.map((c) => c.symbol), ['Fm', 'Db', 'Ab', 'Eb']);
  assert.deepEqual(chords.map((c) => c.startBar), [0, 1, 2, 3]);
});

test('R&B progression produces extended chords', () => {
  const prog = PROGRESSIONS.rnb[0];
  assert.ok(prog);
  const chords = realizeProgression(prog, 0);
  assert.deepEqual(chords.map((c) => c.symbol), ['Cmaj9', 'Am9', 'Dm9', 'G9']);
});

test('every genre progression stays inside its scale and has at least three notes per chord', () => {
  for (const genre of Object.keys(PROGRESSIONS) as Genre[]) {
    for (const prog of PROGRESSIONS[genre]) {
      for (let key = 0; key < 12; key++) {
        for (const chord of realizeProgression(prog, key)) {
          assert.ok(chord.notes.length >= 3, `${prog.id} key ${key}`);
          for (const n of chord.notes) assert.ok(isInScale(n, key, prog.scale), `${prog.id} key ${key} note ${n}`);
          assert.notEqual(chord.symbol, '?', `${prog.id} key ${key} unnamed chord ${chord.notes.join(',')}`);
        }
      }
    }
  }
});
