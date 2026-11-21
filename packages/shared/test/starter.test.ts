import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PROJECT_SCHEMA_VERSION, STEPS_PER_BAR, createBlankProject, createStarterProject, isInScale, type Genre } from '../src/index';

const GENRES: Genre[] = ['trap', 'drill', 'rnb', 'afro'];

describe('starter projects', () => {
  for (const genre of GENRES) {
    it(`${genre}: is a valid, self-consistent project`, () => {
      const p = createStarterProject(genre);
      assert.equal(p.version, PROJECT_SCHEMA_VERSION);
      assert.equal(p.genre, genre);
      assert.ok(p.bpm >= 60 && p.bpm <= 160);
      assert.ok(p.channels.length >= 5);
      assert.equal(new Set(p.channels.map((c) => c.id)).size, p.channels.length, 'unique channel ids');
      const steps = p.bars * STEPS_PER_BAR;
      for (const c of p.channels) {
        assert.match(c.color, /^ch-(1[0-2]|[1-9])$/);
        if (c.type === 'drum') {
          assert.equal(c.v.length, steps);
          assert.equal(c.r.length, steps);
          assert.ok(c.v.every((v) => v >= 0 && v <= 1));
          assert.ok(c.v.some((v) => v > 0), `${c.id} has no hits`);
        } else {
          assert.ok(c.notes.length > 0, `${c.id} has no notes`);
          assert.equal(new Set(c.notes.map((n) => n.id)).size, c.notes.length, `${c.id} duplicate note ids`);
          for (const n of c.notes) {
            assert.ok(n.t >= 0 && n.t + n.d <= steps + 1e-9, `${c.id} note runs past the pattern`);
            assert.ok(n.n >= 24 && n.n <= 96 && n.v > 0 && n.v <= 1);
          }
        }
      }
    });

    it(`${genre}: has a kick on the downbeat and a backbeat`, () => {
      const p = createStarterProject(genre);
      const kick = p.channels.find((c) => c.type === 'drum' && c.drum === 'kick');
      const snare = p.channels.find((c) => c.type === 'drum' && (c.drum === 'snare' || c.drum === 'clap'));
      assert.ok(kick?.type === 'drum' && (kick.v[0] ?? 0) > 0, 'kick on step 1');
      assert.ok(snare?.type === 'drum' && (snare.v[8] ?? 0) > 0, 'backbeat on step 9');
    });
  }

  it('chords and bass stay in the key (genre-appropriate scale)', () => {
    for (const genre of GENRES) {
      const p = createStarterProject(genre);
      for (const c of p.channels) {
        if (c.type !== 'inst') continue;
        const inKey = c.notes.filter((n) => isInScale(n.n, p.key, p.scale)).length;
        assert.ok(inKey / c.notes.length >= 0.7, `${genre}/${c.id}: only ${inKey}/${c.notes.length} notes in ${p.scale}`);
      }
    }
  });

  it('every call returns a fresh object, so one project can be edited without changing another', () => {
    const a = createStarterProject('trap');
    const b = createStarterProject('trap');
    assert.notEqual(a, b);
    assert.deepEqual(a, b);
  });

  it('a blank project keeps the tempo and key but has no channels', () => {
    const p = createBlankProject('rnb');
    assert.equal(p.channels.length, 0);
    assert.equal(p.bpm, createStarterProject('rnb').bpm);
  });
});
