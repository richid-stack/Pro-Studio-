import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { goertzel, peak, renderOffline, rms, type HostCommand } from '../src/index';
import { trapProject } from './fixtures';

/**
 * A fingerprint of a whole rendered beat: loudness per quarter second, the peak, and energy in a few
 * frequency bands. If a change shifts the sound (a filter, an envelope, the swing maths), this fails and
 * says where. Update on purpose with UPDATE_GOLDEN=1 and review the diff like any other change.
 */
const FILE = join(dirname(fileURLToPath(import.meta.url)), 'golden', 'trap-2bar.json');
const SR = 44100;

function fingerprint(): { windows: number[]; peak: number; bands: Record<string, number> } {
  const base = trapProject();
  const pans = [0, 0, 0.2, -0.3, 0.4, 0, -0.2];
  const channels = base.channels.map((c, i) => ({
    ...c,
    mix: {
      ...c.mix,
      rev: c.id === 'keys' || c.id === 'snare' ? 0.25 : 0,
      dly: c.id === 'hat' ? 0.15 : 0,
      duck: c.id === 'keys' || c.id === 'bass' ? 0.5 : 0,
      pan: pans[i] ?? 0,
    },
  }));
  const project = trapProject({ swing: 0.2, channels });
  const cmds: HostCommand[] = [{ type: 'setProject', project }, { type: 'play' }];
  const { left, right } = renderOffline({ seconds: 3.4, commands: cmds });
  const win = Math.floor(SR / 4);
  const windows: number[] = [];
  for (let i = 0; i + win <= left.length; i += win) windows.push(Math.round(((rms(left, i, i + win) + rms(right, i, i + win)) / 2) * 1e4) / 1e4);
  const band = (hz: number[]) => Math.round(hz.reduce((s, f) => s + goertzel(left, f, SR) + goertzel(right, f, SR), 0) * 1e6) / 1e6;
  return { windows, peak: Math.round(Math.max(peak(left), peak(right)) * 1e4) / 1e4, bands: { sub: band([41, 49, 58]), low: band([130, 196, 262]), mid: band([1000, 2000, 3500]), high: band([8000, 10500, 13000]) } };
}

describe('golden render', () => {
  it('a two-bar trap beat still sounds the way it did', () => {
    const now = fingerprint();
    if (process.env.UPDATE_GOLDEN === '1' || !existsSync(FILE)) {
      writeFileSync(FILE, `${JSON.stringify(now, null, 2)}\n`);
      return;
    }
    const want = JSON.parse(readFileSync(FILE, 'utf8')) as typeof now;
    assert.equal(now.windows.length, want.windows.length);
    now.windows.forEach((w, i) => assert.ok(Math.abs(w - (want.windows[i] as number)) <= 0.004 + 0.03 * (want.windows[i] as number), `window ${i} (${i / 4}s): ${w} vs ${want.windows[i]}`));
    assert.ok(Math.abs(now.peak - want.peak) < 0.03, `peak ${now.peak} vs ${want.peak}`);
    for (const k of Object.keys(want.bands)) {
      const a = now.bands[k] as number;
      const b = want.bands[k] as number;
      assert.ok(Math.abs(a - b) <= 1e-6 + 0.08 * b, `band ${k}: ${a} vs ${b}`);
    }
  });

  it('is audibly a beat: loud on the downbeat, a real dynamic range, not a wall of noise', () => {
    const f = fingerprint();
    assert.ok(f.peak > 0.5 && f.peak <= 0.98 + 1e-4);
    assert.ok(f.bands.sub > f.bands.high, 'a trap beat has more sub than air');
    assert.ok(Math.max(...f.windows) / Math.max(1e-6, Math.min(...f.windows.slice(0, 12))) < 60, 'level swings are sane');
  });
});
