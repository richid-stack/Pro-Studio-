#!/usr/bin/env node
/**
 * Dependency direction (docs/ARCHITECTURE.md section 2). One-way: shared <- engine, ui <- apps.
 * Fails on: a workspace import that a unit is not allowed to make, a relative import that crosses a
 * package boundary, anything that imports prototype/, and a unit that has no rule at all (so a new
 * package cannot slip in unchecked).
 */
import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { posix, walk } from './lib/walk.mjs';

/** unit directory -> workspace packages it may import. */
export const RULES = {
  'packages/shared': [],
  'packages/engine': ['@pro-studio/shared'],
  'packages/ui': ['@pro-studio/shared'],
  'apps/web': ['@pro-studio/shared', '@pro-studio/engine', '@pro-studio/ui'],
  'apps/api': ['@pro-studio/shared'],
};

const SOURCE = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const PATTERNS = [
  /\bfrom\s*['"]([^'"]+)['"]/g,
  /(?:^|[;\s])import\s*['"]([^'"]+)['"]/g,
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
];

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

export function importsOf(source) {
  const text = stripComments(source);
  const found = [];
  for (const re of PATTERNS) {
    re.lastIndex = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) found.push(m[1]);
  }
  return found;
}

export function unitOf(relPath) {
  const [a, b] = relPath.split('/');
  return a && b ? `${a}/${b}` : undefined;
}

/**
 * @param {{ path: string, source: string }[]} files  paths relative to the repo root, forward slashes
 * @returns {string[]} violations
 */
export function checkImports(files, rules = RULES) {
  const violations = [];
  const reportedUnits = new Set();
  for (const { path, source } of files) {
    if (!SOURCE.test(path)) continue;
    const unit = unitOf(path);
    if (!unit || !(unit.startsWith('apps/') || unit.startsWith('packages/'))) continue;
    const allowed = rules[unit];
    if (!allowed) {
      if (!reportedUnits.has(unit)) {
        reportedUnits.add(unit);
        violations.push(`${unit}: no dependency rule. Add one to RULES in scripts/check-deps.mjs.`);
      }
      continue;
    }
    for (const spec of importsOf(source)) {
      if (/(^|\/)prototype(\/|$)/.test(spec)) {
        violations.push(`${path}: imports from prototype/ ("${spec}"). It is reference material only.`);
        continue;
      }
      if (spec.startsWith('@pro-studio/')) {
        const pkg = spec.split('/').slice(0, 2).join('/');
        if (!allowed.includes(pkg)) {
          violations.push(`${path}: ${unit} may not import ${pkg}. Allowed: ${allowed.join(', ') || 'no workspace packages'}.`);
        }
        continue;
      }
      if (spec.startsWith('.')) {
        const target = posix(join(dirname(path), spec));
        const normalised = posix(resolve('/', target)).slice(1);
        if (!(normalised === unit || normalised.startsWith(`${unit}/`))) {
          violations.push(`${path}: relative import "${spec}" leaves ${unit}. Import the package by name instead.`);
          continue;
        }
        if (/(^|\/)prototype(\/|$)/.test(normalised)) {
          violations.push(`${path}: imports from prototype/ ("${spec}").`);
        }
      }
    }
  }
  return violations;
}

export function scanRepo(root) {
  const files = [];
  for (const base of ['apps', 'packages']) {
    for (const abs of walk(join(root, base))) {
      if (!SOURCE.test(abs)) continue;
      files.push({ path: posix(relative(root, abs)), source: readFileSync(abs, 'utf8') });
    }
  }
  return files;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const files = scanRepo(root);
  const violations = checkImports(files);
  if (violations.length) {
    console.error(`check:deps found ${violations.length} problem(s):\n${violations.map((v) => `  - ${v}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`check:deps ok (${files.length} source files, ${Object.keys(RULES).length} units)`);
}
