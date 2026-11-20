import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', 'test-results', 'playwright-report', '.git', '.vite']);

/** Every file under `dir` (recursively), skipping build output and dependencies. Paths are absolute. */
export function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** Normalises a path to forward slashes so output and baselines are stable across operating systems. */
export function posix(p) {
  return p.split('\\').join('/');
}
