#!/usr/bin/env node
/**
 * Contrast gate (WCAG 2.2 AA). Reads src/styles/tokens.css, resolves every colour token for each theme,
 * and checks the pairs the product actually uses. Exits 1 on any failure, so CI blocks palette regressions.
 *
 *   4.5:1  text and text-like glyphs (icons that carry meaning)
 *   3:1    essential non-text graphics: control borders, focus ring, meters, playhead, channel colours
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '../src/styles/tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Parse flat rule blocks (the token file has no nested at-rules). */
const blocks = [];
for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selectors = m[1].split(',').map((s) => s.trim());
  const decls = {};
  for (const d of m[2].split(';')) {
    const i = d.indexOf(':');
    if (i > 0) decls[d.slice(0, i).trim()] = d.slice(i + 1).trim();
  }
  blocks.push({ selectors, decls });
}

function themeVars(theme) {
  const vars = {};
  for (const b of blocks) {
    if (b.selectors.some((s) => s === ':root' || s === `:root[data-theme='${theme}']`)) Object.assign(vars, b.decls);
  }
  return vars;
}

function resolve(vars, name, seen = new Set()) {
  let v = vars[name];
  if (v === undefined) throw new Error(`undefined token ${name}`);
  const ref = /^var\((--[\w-]+)\)$/.exec(v);
  if (ref) {
    if (seen.has(name)) throw new Error(`cycle at ${name}`);
    return resolve(vars, ref[1], new Set([...seen, name]));
  }
  return v;
}

function rgb(hex) {
  const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!h) throw new Error(`not a hex colour: ${hex}`);
  let s = h[1];
  if (s.length === 3) s = [...s].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
}
const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (hex) => {
  const [r, g, b] = rgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const SURFACES = ['--bg', '--surface-inset', '--surface-1', '--surface-2', '--surface-3', '--surface-4'];
const PANELS = ['--surface-1', '--surface-2', '--surface-3', '--surface-inset'];
const CHANNELS = Array.from({ length: 12 }, (_, i) => `--ch-${i + 1}`);

const checks = [
  ...SURFACES.map((bg) => ['--text-primary', bg, 4.5]),
  ...SURFACES.map((bg) => ['--text-secondary', bg, 4.5]),
  ...SURFACES.map((bg) => ['--text-muted', bg, 4.5]),
  ...PANELS.map((bg) => ['--accent', bg, 4.5]),
  ['--accent-contrast', '--accent', 4.5],
  ['--accent-contrast', '--accent-hover', 4.5],
  ['--accent-contrast', '--accent-pressed', 4.5],
  ['--text-primary', '--accent-subtle', 4.5],
  ...PANELS.map((bg) => ['--success', bg, 4.5]),
  ...PANELS.map((bg) => ['--warning', bg, 4.5]),
  ...PANELS.map((bg) => ['--danger', bg, 4.5]),
  ['--danger-contrast', '--danger-fill', 4.5],
  ...PANELS.map((bg) => ['--border-control', bg, 3]),
  ...PANELS.map((bg) => ['--focus-ring', bg, 3]),
  ...PANELS.map((bg) => ['--meter-ok', bg, 3]),
  ...PANELS.map((bg) => ['--meter-warn', bg, 3]),
  ...PANELS.map((bg) => ['--meter-clip', bg, 3]),
  ['--playhead', '--surface-inset', 3],
  ['--key-white-text', '--key-white', 4.5],
  ['--key-black-text', '--key-black', 4.5],
  ['--accent-contrast', '--accent-pressed', 4.5],
  // chrome: the header strips and the numbers display
  ...['--chrome-bar', '--chrome-menu', '--chrome-lcd'].map((bg) => ['--chrome-text', bg, 4.5]),
  ['--chrome-hint', '--chrome-bar', 4.5],
  ['--lcd-pale-ink', '--lcd-pale', 4.5],
  // lit state: the dark icon on the glowing face, and the LED against every panel
  ['--lit-ink', '--lit-core', 4.5],
  ['--lit-ink', '--lit-glow', 4.5],
  ...PANELS.map((bg) => ['--led-on', bg, 3]),
  ...PANELS.map((bg) => ['--record', bg, 3]),
  ...CHANNELS.flatMap((c) => [[c, '--surface-1', 3], [c, '--surface-inset', 3], ['--text-on-channel', c, 4.5]]),
];

const darkVars = themeVars('dark');
const lightVars = themeVars('light');
let failures = 0;

// A light theme that forgets a token would silently inherit the dark value.
const lightBlock = blocks.find((b) => b.selectors.includes(`:root[data-theme='light']`));
const darkBlock = blocks.find((b) => b.selectors.includes(`:root[data-theme='dark']`));
for (const k of Object.keys(darkBlock.decls)) {
  if (!(k in lightBlock.decls)) {
    console.log(`FAIL  light theme does not redefine ${k}`);
    failures++;
  }
}

for (const [theme, vars] of [['dark', darkVars], ['light', lightVars]]) {
  let worst = Infinity;
  let n = 0;
  for (const [fg, bg, min] of checks) {
    const f = resolve(vars, fg);
    const b = resolve(vars, bg);
    const r = ratio(f, b);
    n++;
    worst = Math.min(worst, r / min);
    if (r < min) {
      failures++;
      console.log(`FAIL  ${theme.padEnd(5)} ${fg} on ${bg}: ${r.toFixed(2)}:1 needs ${min}:1  (${f} on ${b})`);
    }
  }
  console.log(`${theme}: ${n} pairs checked`);
}

if (failures) {
  console.log(`\n${failures} contrast failure(s)`);
  process.exit(1);
}
console.log('\nAll contrast checks pass (WCAG 2.2 AA).');
