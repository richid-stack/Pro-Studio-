import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkSounds } from '../check-sounds.mjs';

function fixture(files, manifest) {
  const dir = mkdtempSync(join(tmpdir(), 'sounds-'));
  for (const [name, data] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), data);
  }
  if (manifest !== undefined) writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest));
  return dir;
}
const entry = (over = {}) => ({ id: 'k1', name: 'Kick', file: 'kit/k1.flac', kind: 'one-shot', license: 'own', author: 'Pro Studio', ...over });
const sha = (s) => createHash('sha256').update(s).digest('hex');

test('no sounds directory passes', () => {
  assert.deepEqual(checkSounds(join(tmpdir(), 'definitely-not-here-xyz')), []);
});

test('a complete entry passes, including its checksum', () => {
  const dir = fixture({ 'kit/k1.flac': 'audio' }, [entry({ sha256: sha('audio') })]);
  assert.deepEqual(checkSounds(dir), []);
  rmSync(dir, { recursive: true });
});

test('an audio file with no manifest entry fails', () => {
  const dir = fixture({ 'kit/k1.flac': 'a', 'kit/loose.wav': 'b' }, [entry()]);
  assert.match(checkSounds(dir).join('\n'), /loose\.wav: no manifest entry/);
  rmSync(dir, { recursive: true });
});

test('audio without any manifest fails', () => {
  const dir = fixture({ 'kit/k1.flac': 'a' });
  assert.match(checkSounds(dir).join('\n'), /no manifest\.json/);
  rmSync(dir, { recursive: true });
});

test('missing or unknown licence fails', () => {
  const dir = fixture({ 'kit/k1.flac': 'a' }, [entry({ license: undefined })]);
  assert.match(checkSounds(dir).join('\n'), /missing "license"/);
  const dir2 = fixture({ 'kit/k1.flac': 'a' }, [entry({ license: 'royalty-free' })]);
  assert.match(checkSounds(dir2).join('\n'), /not one of/);
  rmSync(dir, { recursive: true });
  rmSync(dir2, { recursive: true });
});

test('CC-BY needs attribution, licensed needs a licence URL, own needs an author', () => {
  const dir = fixture({ 'kit/k1.flac': 'a' }, [entry({ license: 'CC-BY-4.0', author: 'X' })]);
  assert.match(checkSounds(dir).join('\n'), /requires "attribution"/);
  const dir2 = fixture({ 'kit/k1.flac': 'a' }, [entry({ license: 'licensed' })]);
  assert.match(checkSounds(dir2).join('\n'), /requires "licenseUrl"/);
  const dir3 = fixture({ 'kit/k1.flac': 'a' }, [entry({ author: undefined })]);
  assert.match(checkSounds(dir3).join('\n'), /requires "author"/);
  for (const d of [dir, dir2, dir3]) rmSync(d, { recursive: true });
});

test('a wrong checksum, a missing file and a duplicate id fail', () => {
  const dir = fixture({ 'kit/k1.flac': 'a' }, [
    entry({ sha256: sha('different') }),
    entry({ file: 'kit/ghost.flac' }),
  ]);
  const out = checkSounds(dir).join('\n');
  assert.match(out, /sha256 does not match/);
  assert.match(out, /does not exist/);
  assert.match(out, /duplicate id/);
  rmSync(dir, { recursive: true });
});
