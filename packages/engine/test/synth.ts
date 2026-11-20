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
