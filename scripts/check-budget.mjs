#!/usr/bin/env node
/**
 * Performance budget (docs/ARCHITECTURE.md section 9): initial JavaScript under 250 kB gzipped,
 * before the audio engine loads. "Initial" = the module scripts and modulepreloads that
 * apps/web/dist/index.html loads up front. Run after `pnpm build`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

export const BUDGET_BYTES = 250 * 1024;

/** Initial JS asset URLs referenced from the built index.html. */
export function initialScripts(html) {
  const urls = new Set();
  for (const m of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)) urls.add(m[1]);
  for (const m of html.matchAll(/<link\b[^>]*rel=["']modulepreload["'][^>]*\bhref=["']([^"']+)["']/g)) urls.add(m[1]);
  for (const m of html.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*rel=["']modulepreload["']/g)) urls.add(m[1]);
  return [...urls].filter((u) => /\.m?js(\?|$)/.test(u));
}

/** Finds the file for a (possibly base-prefixed) URL inside dist. */
export function resolveAsset(distDir, url) {
  const segments = new URL(url, 'http://localhost/').pathname.split('/').filter(Boolean);
  for (let i = 0; i < segments.length; i++) {
    const candidate = join(distDir, ...segments.slice(i));
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

export function measure(distDir) {
  const indexPath = join(distDir, 'index.html');
  if (!existsSync(indexPath)) throw new Error(`${indexPath} not found. Run pnpm build first.`);
  const assets = initialScripts(readFileSync(indexPath, 'utf8')).map((url) => {
    const file = resolveAsset(distDir, url);
    if (!file) throw new Error(`index.html references ${url} but it is not in dist`);
    return { url, gzip: gzipSync(readFileSync(file)).length };
  });
  return { assets, total: assets.reduce((s, a) => s + a.gzip, 0) };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const { assets, total } = measure(join(root, 'apps/web/dist'));
  const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
  for (const a of assets) console.log(`  ${kb(a.gzip).padStart(9)}  ${a.url}`);
  console.log(`initial JS gzipped: ${kb(total)} of ${kb(BUDGET_BYTES)}`);
  if (total > BUDGET_BYTES) {
    console.error('check:budget failed: initial JavaScript is over budget. Lazy-load the heavy feature.');
    process.exit(1);
  }
}
