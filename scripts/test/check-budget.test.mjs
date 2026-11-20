import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { BUDGET_BYTES, initialScripts, measure, resolveAsset } from '../check-budget.mjs';

const html = `<!doctype html><html><head>
<script type="module" crossorigin src="/Pro-Studio-/assets/index-abc.js"></script>
<link rel="modulepreload" crossorigin href="/Pro-Studio-/assets/vendor-def.js">
<link rel="stylesheet" href="/Pro-Studio-/assets/index-xyz.css">
</head><body></body></html>`;

test('initial scripts are the module script and modulepreloads, not CSS', () => {
  assert.deepEqual(initialScripts(html), ['/Pro-Studio-/assets/index-abc.js', '/Pro-Studio-/assets/vendor-def.js']);
});

test('assets resolve through a base path prefix', () => {
  const dist = mkdtempSync(join(tmpdir(), 'dist-'));
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'assets', 'index-abc.js'), 'x');
  assert.equal(resolveAsset(dist, '/Pro-Studio-/assets/index-abc.js'), join(dist, 'assets', 'index-abc.js'));
  assert.equal(resolveAsset(dist, '/assets/missing.js'), undefined);
  rmSync(dist, { recursive: true });
});

test('measure sums gzipped initial scripts', () => {
  const dist = mkdtempSync(join(tmpdir(), 'dist-'));
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'index.html'), html);
  writeFileSync(join(dist, 'assets', 'index-abc.js'), 'a'.repeat(5000));
  writeFileSync(join(dist, 'assets', 'vendor-def.js'), 'b'.repeat(5000));
  const { assets, total } = measure(dist);
  assert.equal(assets.length, 2);
  assert.ok(total > 0 && total < 1000, `highly repetitive input should compress hard, got ${total}`);
  assert.ok(total < BUDGET_BYTES);
  rmSync(dist, { recursive: true });
});

test('measure fails loudly when dist is missing or an asset is absent', () => {
  assert.throws(() => measure(join(tmpdir(), 'no-dist-here-xyz')), /Run pnpm build first/);
  const dist = mkdtempSync(join(tmpdir(), 'dist-'));
  writeFileSync(join(dist, 'index.html'), html);
  assert.throws(() => measure(dist), /not in dist/);
  rmSync(dist, { recursive: true });
});
