import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkImports, importsOf, scanRepo } from '../check-deps.mjs';

const f = (path, source) => ({ path, source });

test('importsOf finds every import form and ignores comments', () => {
  const found = importsOf(`
    import a from './a';
    import type { B } from "@pro-studio/shared";
    import './side-effect.css';
    export * from '../c';
    const d = await import('./d');
    const e = require('node:fs');
    // import nope from 'commented-out';
    /* import nope2 from 'block-comment'; */
  `);
  assert.deepEqual(found.sort(), ['./a', './d', './side-effect.css', '../c', '@pro-studio/shared', 'node:fs'].sort());
});

test('shared may import nothing from the workspace', () => {
  const v = checkImports([f('packages/shared/src/x.ts', `import { y } from '@pro-studio/engine';`)]);
  assert.equal(v.length, 1);
  assert.match(v[0], /may not import @pro-studio\/engine/);
});

test('engine may import shared but not ui or apps', () => {
  assert.deepEqual(checkImports([f('packages/engine/src/x.ts', `import {a} from '@pro-studio/shared';`)]), []);
  assert.equal(checkImports([f('packages/engine/src/x.ts', `import {a} from '@pro-studio/ui';`)]).length, 1);
  assert.equal(checkImports([f('packages/engine/src/x.ts', `import {a} from '@pro-studio/web';`)]).length, 1);
});

test('apps may import packages, and web may not import api', () => {
  assert.deepEqual(
    checkImports([f('apps/web/src/x.ts', `import {a} from '@pro-studio/engine'; import {b} from '@pro-studio/ui/styles/index.css';`)]),
    [],
  );
  assert.equal(checkImports([f('apps/web/src/x.ts', `import {a} from '@pro-studio/api';`)]).length, 1);
});

test('relative imports that leave the package are rejected', () => {
  const v = checkImports([f('packages/engine/src/deep/x.ts', `import {a} from '../../../shared/src/theory';`)]);
  assert.equal(v.length, 1);
  assert.match(v[0], /leaves packages\/engine/);
  assert.deepEqual(checkImports([f('packages/engine/src/deep/x.ts', `import {a} from '../../test/synth';`)]), []);
});

test('nothing may import prototype/', () => {
  assert.equal(checkImports([f('apps/web/src/x.ts', `import p from '../../../prototype/src/01-dsp.js';`)]).length, 1);
});

test('a unit without a rule is reported once', () => {
  const v = checkImports([f('packages/new/src/a.ts', `export {}`), f('packages/new/src/b.ts', `export {}`)]);
  assert.equal(v.length, 1);
  assert.match(v[0], /no dependency rule/);
});

test('the repository itself is clean', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  assert.deepEqual(checkImports(scanRepo(root)), []);
});
