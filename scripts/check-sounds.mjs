#!/usr/bin/env node
/**
 * Sound manifest gate (docs/SOUND-LIBRARY.md). Every audio file under apps/web/public/sounds needs a
 * manifest entry with a licence we can redistribute; CC-BY needs attribution; the recorded sha256
 * must match the file. Passes when there is no sounds directory yet.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { posix, walk } from './lib/walk.mjs';

export const SOUNDS_DIR = 'apps/web/public/sounds';
export const LICENSES = ['own', 'CC0-1.0', 'CC-BY-4.0', 'CC-BY-3.0', 'licensed'];
const AUDIO = /\.(?:flac|wav|mp3|ogg|opus|m4a|aif|aiff)$/i;
const REQUIRED = ['id', 'name', 'file', 'kind', 'license'];

/**
 * @param {string} soundsDir absolute path
 * @returns {string[]} problems
 */
export function checkSounds(soundsDir) {
  if (!existsSync(soundsDir)) return [];
  const problems = [];
  const manifestPath = join(soundsDir, 'manifest.json');
  const files = walk(soundsDir)
    .filter((f) => AUDIO.test(f))
    .map((f) => posix(relative(soundsDir, f)));
  if (!existsSync(manifestPath)) {
    return files.length ? [`${files.length} sound file(s) but no manifest.json`] : [];
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    return [`manifest.json is not valid JSON: ${e.message}`];
  }
  const entries = Array.isArray(manifest) ? manifest : manifest.sounds;
  if (!Array.isArray(entries)) return ['manifest.json must be an array or { "sounds": [...] }'];

  const ids = new Set();
  const listed = new Set();
  for (const e of entries) {
    const tag = e?.id ?? e?.file ?? '(entry without id)';
    for (const f of REQUIRED) if (e?.[f] == null || e[f] === '') problems.push(`${tag}: missing "${f}"`);
    if (e?.id) {
      if (ids.has(e.id)) problems.push(`${tag}: duplicate id`);
      ids.add(e.id);
    }
    if (e?.license && !LICENSES.includes(e.license)) problems.push(`${tag}: licence "${e.license}" is not one of ${LICENSES.join(', ')}`);
    if (e?.license?.startsWith('CC-BY') && !e.attribution) problems.push(`${tag}: ${e.license} requires "attribution"`);
    if (e?.license === 'licensed' && !e.licenseUrl) problems.push(`${tag}: "licensed" requires "licenseUrl" (keep the licence text in the repo too)`);
    if (e?.license === 'own' && !e.author) problems.push(`${tag}: "own" requires "author"`);
    if (!e?.file) continue;
    listed.add(e.file);
    const abs = join(soundsDir, e.file);
    if (!existsSync(abs)) {
      problems.push(`${tag}: file "${e.file}" does not exist`);
      continue;
    }
    if (e.sha256) {
      const actual = createHash('sha256').update(readFileSync(abs)).digest('hex');
      if (actual !== e.sha256) problems.push(`${tag}: sha256 does not match the file`);
    }
  }
  for (const f of files) if (!listed.has(f)) problems.push(`${f}: no manifest entry (a sound without a licence record cannot ship)`);
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const dir = join(root, SOUNDS_DIR);
  const problems = checkSounds(dir);
  if (problems.length) {
    console.error(`check:sounds found ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log(existsSync(dir) ? 'check:sounds ok' : 'check:sounds ok (no sounds directory yet)');
}
