#!/usr/bin/env node
/**
 * CLAUDE.md rule 3: tokens only. No hex or functional colour literals and no raw pixel sizes in app
 * code. Hairlines (0, 1 and 2 px) and media-query breakpoints are allowed. A deliberate exception
 * carries a `token-ok: reason` comment on the same line. Existing violations are recorded in
 * scripts/token-baseline.json so the check blocks new ones without a big-bang cleanup; the baseline
 * should only ever shrink (run with --update-baseline after paying some down).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { posix, walk } from './lib/walk.mjs';

const SCAN_DIRS = ['apps/web/src'];
const EXEMPT = [/(^|\/)tokens\.css$/];
const EXTENSIONS = /\.(?:css|ts|tsx)$/;
const COLOR_FN = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(([^)]*)\)/g;
const HEX_IN_VALUE = /:[^;{}]*#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/;
const HEX_IN_STRING = /['"`]#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})['"`]/;
const PX = /(?<![\w.-])(\d*\.?\d+)px\b/g;
const ALLOWED_PX = new Set(['0', '1', '2']);

function stripBlockComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

/** @returns {{ rule: string, line: number, text: string }[]} */
export function findViolations(path, source) {
  const isCss = path.endsWith('.css');
  const out = [];
  const original = source.split('\n');
  const lines = stripBlockComments(source).split('\n');
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('//') || original[i]?.includes('token-ok')) return;
    const add = (rule) => out.push({ rule, line: i + 1, text: line });

    if (isCss ? HEX_IN_VALUE.test(line) : HEX_IN_STRING.test(line)) add('hex-colour');
    COLOR_FN.lastIndex = 0;
    for (let m = COLOR_FN.exec(line); m; m = COLOR_FN.exec(line)) {
      if (!m[1].includes('var(')) add('colour-function');
    }
    if (/^@(?:media|container|supports)\b/.test(line)) return;
    PX.lastIndex = 0;
    for (let m = PX.exec(line); m; m = PX.exec(line)) {
      if (!ALLOWED_PX.has(m[1])) add('raw-px');
    }
  });
  return out;
}

const key = (file, v) => `${file}|${v.rule}|${v.text}`;

export function scan(root) {
  const results = [];
  for (const dir of SCAN_DIRS) {
    for (const abs of walk(join(root, dir))) {
      const rel = posix(relative(root, abs));
      if (!EXTENSIONS.test(rel) || EXEMPT.some((re) => re.test(rel))) continue;
      for (const v of findViolations(rel, readFileSync(abs, 'utf8'))) results.push({ file: rel, ...v });
    }
  }
  return results;
}

/** Splits current violations into new ones (fail) and stale baseline entries (warn). */
export function compareToBaseline(current, baselineKeys) {
  const base = new Set(baselineKeys);
  const now = new Set(current.map((v) => key(v.file, v)));
  return {
    fresh: current.filter((v) => !base.has(key(v.file, v))),
    stale: [...base].filter((k) => !now.has(k)),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const baselinePath = join(root, 'scripts', 'token-baseline.json');
  const current = scan(root);
  if (process.argv.includes('--update-baseline')) {
    const keys = [...new Set(current.map((v) => key(v.file, v)))].sort();
    writeFileSync(baselinePath, `${JSON.stringify(keys, null, 2)}\n`);
    console.log(`check:tokens baseline written (${keys.length} entries)`);
  } else {
    const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : [];
    const { fresh, stale } = compareToBaseline(current, baseline);
    for (const k of stale) console.warn(`check:tokens: baseline entry no longer needed, remove it: ${k}`);
    if (fresh.length) {
      console.error(
        `check:tokens found ${fresh.length} new violation(s) of CLAUDE.md rule 3 (use a token, or add "token-ok: reason"):\n` +
          fresh.map((v) => `  - ${v.file}:${v.line} [${v.rule}] ${v.text}`).join('\n'),
      );
      process.exit(1);
    }
    console.log(`check:tokens ok (${current.length} known, ${baseline.length} in baseline)`);
  }
}
