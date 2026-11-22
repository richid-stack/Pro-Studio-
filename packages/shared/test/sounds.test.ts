import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DRUM_NAMES_FOR_TEST } from './support';
import { SOUND_LIBRARY, meterFall, searchSounds, setProjectName, createStarterProject } from '../src/index';

describe('sound library', () => {
  it('has unique ids and only offers sounds the engine can make', () => {
    assert.equal(new Set(SOUND_LIBRARY.map((s) => s.id)).size, SOUND_LIBRARY.length);
    for (const s of SOUND_LIBRARY) {
      if (s.kind === 'drum') assert.ok(DRUM_NAMES_FOR_TEST.includes(s.drum), s.id);
      else assert.ok(!['chop', 'sampler'].includes(s.inst), `${s.id} needs audio files, which cannot be loaded yet`);
    }
  });

  it('every drum has an entry', () => {
    for (const d of DRUM_NAMES_FOR_TEST) assert.ok(SOUND_LIBRARY.some((s) => s.kind === 'drum' && s.drum === d), d);
  });

  it('search needs every word and ignores case', () => {
    assert.equal(searchSounds('').length, SOUND_LIBRARY.length);
    assert.deepEqual(searchSounds('OPEN shimmer').map((s) => s.id), ['drum:ohat']);
    assert.ok(searchSounds('drum').every((s) => s.kind === 'drum'));
    assert.deepEqual(searchSounds('zzz'), []);
  });
});

describe('meter ballistics', () => {
  it('rises at once and falls at the release rate', () => {
    assert.equal(meterFall(0.2, 0.9, 33), 0.9);
    assert.ok(Math.abs(meterFall(0.9, 0, 500) - 0.3) < 1e-9);
    assert.equal(meterFall(0.1, 0, 5000), 0);
    assert.equal(meterFall(0.5, 0, -10), 0.5);
  });
});

describe('project name', () => {
  it('trims, falls back when empty and keeps the same object when unchanged', () => {
    const p = createStarterProject('trap');
    assert.equal(setProjectName(p, p.name), p);
    assert.equal(setProjectName(p, '  Night shift  ').name, 'Night shift');
    assert.equal(setProjectName(p, '   ').name, 'Untitled beat');
    assert.equal(setProjectName(p, 'x'.repeat(200)).name.length, 80);
  });
});
