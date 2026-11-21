/** Deterministic test signals. */
export const SR = 44100;

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gauss = (r: () => number): number => {
  const u = Math.max(1e-9, r());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
};

/** Mix a hit into the buffer at time t (seconds). */
function add(buf: Float32Array, t: number, hit: Float32Array): void {
  const i = Math.floor(t * SR);
  for (let k = 0; k < hit.length && i + k < buf.length; k++) buf[i + k] = (buf[i + k] as number) + (hit[k] as number);
}

export function kick(len = 0.6): Float32Array {
  const n = Math.floor(len * SR);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    phase += (2 * Math.PI * (45 + 120 * Math.exp(-t * 18))) / SR;
    out[i] = Math.sin(phase) * Math.exp(-t * 7) * 0.9;
  }
  return out;
}

export function snare(r: () => number, len = 0.5): Float32Array {
  const n = Math.floor(len * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = gauss(r) * 0.25 * Math.exp(-t * 18) + Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 25) * 0.4;
  }
  return out;
}

export function hat(r: () => number, len = 0.3): Float32Array {
  const n = Math.floor(len * SR);
  const out = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const v = gauss(r) * 0.3;
    out[i] = (v - prev) * Math.exp(-(i / SR) * 30) * 0.8;
    prev = v;
  }
  return out;
}

/** Eight alternating hits, 0.4 s apart starting at 0.1 s, over a little hiss. */
export function drumLoop(): { audio: Float32Array; hits: number[] } {
  const r = rng(5);
  const audio = new Float32Array(Math.floor(3.4 * SR));
  for (let i = 0; i < audio.length; i++) audio[i] = gauss(r) * 0.004;
  const hits: number[] = [];
  for (let k = 0; k < 8; k++) {
    const t = 0.1 + 0.4 * k;
    hits.push(t);
    const kind = k % 4;
    add(audio, t, kind === 0 || kind === 2 ? kick() : kind === 1 ? snare(r) : hat(r));
  }
  return { audio, hits };
}

/** A decaying tone with two overtones, like a plucked or keyed note. */
export function tone(freq: number, seconds: number, decay = 0.35): Float32Array {
  const n = Math.floor(seconds * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.01) * Math.exp(-t * decay);
    out[i] = (Math.sin(2 * Math.PI * freq * t) + 0.4 * Math.sin(4 * Math.PI * freq * t) + 0.2 * Math.sin(6 * Math.PI * freq * t)) * env * 0.4;
  }
  return out;
}

export function noise(seconds: number, seed = 1): Float32Array {
  const r = rng(seed);
  const out = new Float32Array(Math.floor(seconds * SR));
  for (let i = 0; i < out.length; i++) out[i] = (r() * 2 - 1) * 0.3;
  return out;
}

/** A sine at an exact frequency, for filter and pitch tests. */
export function sine(freq: number, seconds: number, sr = SR, amp = 1): Float32Array {
  const out = new Float32Array(Math.floor(seconds * sr));
  for (let i = 0; i < out.length; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / sr);
  return out;
}

import type { Source } from '../src/index';

/** Drive a source directly: run `script` actions at exact frames and collect what it renders. */
export function runSource(src: Source, seconds: number, script: Array<[number, (s: Source) => void]> = [], sr = SR): { l: Float32Array; r: Float32Array } {
  const total = Math.floor(seconds * sr);
  const l = new Float32Array(total);
  const r = new Float32Array(total);
  const acts = script.map(([t, f]) => [Math.round(t * sr), f] as const).sort((a, b) => a[0] - b[0]);
  let cursor = 0;
  let a = 0;
  while (cursor < total) {
    while (a < acts.length && (acts[a] as readonly [number, unknown])[0] <= cursor) {
      (acts[a] as readonly [number, (s: Source) => void])[1](src);
      a++;
    }
    const next = a < acts.length ? Math.min(total, (acts[a] as readonly [number, unknown])[0]) : total;
    const end = Math.min(next, cursor + 512);
    src.render(l, r, cursor, end);
    cursor = end;
  }
  return { l, r };
}

/** Frequency from rising zero crossings over [from, to) seconds. Good to a fraction of a percent on clean tones. */
export function zeroCrossFreq(x: Float32Array, from: number, to: number, sr = SR): number {
  const a = Math.floor(from * sr);
  const b = Math.floor(to * sr);
  let first = -1;
  let last = -1;
  let count = 0;
  for (let i = a + 1; i < b; i++) {
    if ((x[i - 1] as number) < 0 && (x[i] as number) >= 0) {
      const frac = -(x[i - 1] as number) / ((x[i] as number) - (x[i - 1] as number));
      const pos = i - 1 + frac;
      if (first < 0) first = pos;
      last = pos;
      count++;
    }
  }
  return count < 2 ? 0 : ((count - 1) * sr) / (last - first);
}
