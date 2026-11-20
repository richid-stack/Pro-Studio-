import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareToBaseline, findViolations } from '../check-tokens.mjs';

const rules = (path, src) => findViolations(path, src).map((v) => v.rule);

test('hex colours in CSS values are flagged, selectors and tokens are not', () => {
  assert.deepEqual(rules('a.css', '.x { color: #fff; }'), ['hex-colour']);
  assert.deepEqual(rules('a.css', '.x { background: var(--surface); }'), []);
  assert.deepEqual(rules('a.css', '#root { display: block; }'), []);
});

test('functional colours are flagged unless built from tokens', () => {
  assert.deepEqual(rules('a.css', '.x { color: rgb(0 0 0 / 50%); }'), ['colour-function']);
  assert.deepEqual(rules('a.css', '.x { color: rgb(var(--ink) / 50%); }'), []);
  assert.deepEqual(rules('a.css', '.x { color: color-mix(in srgb, var(--a) 50%, transparent); }'), []);
});

test('raw px: hairlines allowed, others flagged', () => {
  assert.deepEqual(rules('a.css', '.x { border: 1px solid var(--border); outline-offset: 2px; margin: 0px; }'), []);
  assert.deepEqual(rules('a.css', '.x { padding: 24px; }'), ['raw-px']);
  assert.deepEqual(rules('a.css', '.x { width: clamp(120px, 22vw, 190px); }'), ['raw-px', 'raw-px']);
});

test('media and container queries may use px breakpoints', () => {
  assert.deepEqual(rules('a.css', '@media (min-width: 768px) {'), []);
  assert.deepEqual(rules('a.css', '@container (min-width: 420px) {'), []);
});

test('token-ok comment is an explicit, searchable escape hatch', () => {
  assert.deepEqual(rules('a.css', '.x { width: 37px; } /* token-ok: matches the hardware pad */'), []);
});

test('hex colours in TS strings are flagged; comments are ignored', () => {
  assert.deepEqual(rules('a.tsx', `const c = '#ff0000';`), ['hex-colour']);
  assert.deepEqual(rules('a.tsx', `// colour is #ff0000`), []);
  assert.deepEqual(rules('a.tsx', `const issue = 'see #123 for details';`), []);
});

test('baseline: only new violations fail, resolved ones are reported stale', () => {
  const current = [
    { file: 'a.css', rule: 'raw-px', line: 3, text: 'width: 1100px;' },
    { file: 'a.css', rule: 'raw-px', line: 9, text: 'height: 40px;' },
  ];
  const { fresh, stale } = compareToBaseline(current, ['a.css|raw-px|width: 1100px;', 'a.css|raw-px|gone: 9px;']);
  assert.deepEqual(fresh.map((v) => v.text), ['height: 40px;']);
  assert.deepEqual(stale, ['a.css|raw-px|gone: 9px;']);
});
