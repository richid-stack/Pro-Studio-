import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createStarterProject, parseProject, parseProjectJson, type Genre } from '../src/index';

describe('parseProject', () => {
  it('accepts every starter unchanged (a saved project reopens exactly)', () => {
    for (const g of ['trap', 'drill', 'rnb', 'afro'] as Genre[]) {
      const p = createStarterProject(g);
      const r = parseProject(JSON.parse(JSON.stringify(p)));
      assert.ok(r.ok);
      assert.deepEqual(r.ok && r.project, p);
    }
  });

  it('rejects things that are not projects, with a reason', () => {
    for (const bad of [null, 5, 'x', [], {}, { version: 99, channels: [] }, { version: 1 }, { version: 1, channels: 'no' }]) {
      const r = parseProject(bad);
      assert.equal(r.ok, false);
      assert.ok(!r.ok && r.error.length > 5);
    }
    assert.equal(parseProjectJson('{not json').ok, false);
    assert.equal(parseProject({ version: 1, channels: new Array(100).fill({}) }).ok, false);
  });

  it('repairs recoverable damage instead of refusing the file', () => {
    const p = createStarterProject('trap');
    const damaged = JSON.parse(JSON.stringify(p));
    damaged.bpm = 9999;
    damaged.swing = -4;
    damaged.channels[0].v = [5, -2];
    damaged.channels[0].mix.db = 'loud';
    damaged.channels[5].notes[0].n = 9999;
    damaged.channels[5].notes[1].id = damaged.channels[5].notes[0].id;
    damaged.channels[1].color = '#ff0000';
    const r = parseProject(damaged);
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.project.bpm, 240);
    assert.equal(r.project.swing, 0);
    const kick = r.project.channels[0];
    assert.ok(kick?.type === 'drum' && kick.v.length === 32 && kick.v[0] === 1 && kick.v[1] === 0 && kick.v[2] === 0);
    assert.equal(kick?.mix.db, -6);
    const bass = r.project.channels[5];
    assert.ok(bass?.type === 'inst' && bass.notes.every((n) => n.n <= 108));
    assert.ok(bass?.type === 'inst' && new Set(bass.notes.map((n) => n.id)).size === bass.notes.length, 'duplicate ids repaired');
    assert.match(r.project.channels[1]?.color ?? '', /^ch-/, 'a hex colour is replaced by a token');
  });

  it('drops channels it cannot understand and duplicate ids, keeps the rest', () => {
    const p = JSON.parse(JSON.stringify(createStarterProject('drill')));
    p.channels.push({ id: 'ghost', type: 'weird' }, { ...p.channels[0] }, { id: '', type: 'drum', drum: 'kick' });
    const r = parseProject(p);
    assert.ok(r.ok && r.project.channels.length === createStarterProject('drill').channels.length);
  });

  it('never trusts script-looking text, and bounds long names', () => {
    const p = JSON.parse(JSON.stringify(createStarterProject('trap')));
    p.name = '<img src=x onerror=alert(1)>'.repeat(20);
    const r = parseProject(p);
    assert.ok(r.ok && r.project.name.length <= 80);
  });
});
