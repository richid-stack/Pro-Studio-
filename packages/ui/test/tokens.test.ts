import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHANNEL_COLORS } from '../src/index';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

test('every channel colour exposed to code is defined in the token file', () => {
  for (const c of CHANNEL_COLORS) {
    const name = /var\((--[\w-]+)\)/.exec(c)?.[1];
    assert.ok(name && css.includes(`${name}:`), `${c} is not defined`);
  }
});

test('the light theme redefines every colour token the dark theme sets', () => {
  const dark = /:root\[data-theme='dark'\][\s\S]*?\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
  const light = /:root\[data-theme='light'\]\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
  const names = (s: string) => [...s.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1] as string);
  const lightSet = new Set(names(light));
  assert.ok(names(dark).length > 40, 'parsed the dark block');
  for (const n of names(dark)) assert.ok(lightSet.has(n), `light theme is missing ${n}`);
});
