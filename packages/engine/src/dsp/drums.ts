/**
 * Drum synthesis. Each drum is rendered once, offline, into a mono buffer at the engine sample rate, then
 * triggered like a sample. Rendering is deterministic (seeded noise), so a project sounds the same on every
 * device and the round-robin variants are stable. Every hit starts on its first sample: timing is the sequencer's job.
 */
import type { DrumName } from '@pro-studio/shared';
import { Biquad, expEnvelope, mulberry32, oscSample, peak, whiteNoise } from './primitives';

export const DRUM_NAMES: readonly DrumName[] = ['kick', 'snare', 'clap', 'hat', 'ohat', 'rim'];

/** How many round-robin variants each drum has. */
export const DRUM_VARIANTS: Record<DrumName, number> = { kick: 1, snare: 3, clap: 3, hat: 3, ohat: 2, rim: 3 };

/** A drum that cuts other drums when it plays (a closed hat shuts an open one). */
export const DRUM_CHOKES: Partial<Record<DrumName, readonly DrumName[]>> = { hat: ['ohat'] };

const DURATION: Record<DrumName, number> = { kick: 1.0, snare: 0.6, clap: 0.55, hat: 0.25, ohat: 0.9, rim: 0.3 };
const TARGET_PEAK: Record<DrumName, number> = { kick: 0.95, snare: 0.9, clap: 0.9, hat: 0.9, ohat: 0.9, rim: 0.9 };
const FADE_SECONDS = 0.01;

function finish(buf: Float32Array, sr: number, target: number): Float32Array {
  const fade = Math.floor(FADE_SECONDS * sr);
  for (let i = 0; i < fade; i++) {
    const k = buf.length - 1 - i;
    buf[k] = (buf[k] as number) * (i / fade);
  }
  const p = peak(buf);
  if (p > 0) {
    const g = target / p;
    for (let i = 0; i < buf.length; i++) buf[i] = (buf[i] as number) * g;
  }
  return buf;
}

function renderKick(sr: number): Float32Array {
  const n = Math.ceil(sr * DURATION.kick);
  const out = new Float32Array(n);
  const pitch = expEnvelope([[0, 215], [0.07, 60], [0.6, 42]]);
  const amp = expEnvelope([[0, 0.0001], [0.002, 1], [0.85, 0.0008]]);
  const clickEnv = expEnvelope([[0, 0.45], [0.012, 0.001]]);
  const clickHp = new Biquad('highpass', sr, 1800);
  const rand = mulberry32(11);
  const sat = 2.4;
  const satNorm = Math.tanh(sat);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    phase += pitch(t) / sr;
    let s = Math.tanh(sat * Math.sin(2 * Math.PI * phase) * amp(t)) / satNorm;
    if (t < 0.05) s += clickHp.process(whiteNoise(rand)) * clickEnv(t);
    out[i] = s;
  }
  return finish(out, sr, TARGET_PEAK.kick);
}

function renderSnare(sr: number, seed: number): Float32Array {
  const n = Math.ceil(sr * DURATION.snare);
  const out = new Float32Array(n);
  const pitch = expEnvelope([[0, 335], [0.05, 178]]);
  const bodyEnv = expEnvelope([[0, 0.0001], [0.002, 0.75], [0.17, 0.001]]);
  const noiseEnv = expEnvelope([[0, 0.0001], [0.001, 1], [0.19 + seed * 0.012, 0.001]]);
  const rand = mulberry32(seed * 13 + 5);
  const hp = new Biquad('highpass', sr, 1400);
  const bp = new Biquad('bandpass', sr, 3900, 0.55);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    phase += pitch(t) / sr;
    const body = t < 0.3 ? oscSample('triangle', phase % 1, 0) * bodyEnv(t) : 0;
    out[i] = body + bp.process(hp.process(whiteNoise(rand))) * noiseEnv(t);
  }
  return finish(out, sr, TARGET_PEAK.snare);
}

function renderClap(sr: number, seed: number): Float32Array {
  const n = Math.ceil(sr * DURATION.clap);
  const out = new Float32Array(n);
  const rand = mulberry32(seed * 7 + 3);
  const hp = new Biquad('highpass', sr, 700);
  const bp = new Biquad('bandpass', sr, 1250 + seed * 60, 1.1);
  const bursts = [0, 0.0105, 0.0225];
  const tailStart = 0.0355;
  const tailEnv = expEnvelope([[0, 1], [0.2, 0.001]]);
  const burstEnvs = bursts.map((_, i) => expEnvelope([[0.001, 0.9 - i * 0.05], [0.0095, 0.12]]));
  const gain = (t: number): number => {
    if (t >= tailStart) {
      const u = t - tailStart;
      return u < 0.001 ? u / 0.001 : tailEnv(u - 0.001);
    }
    let g = 0;
    bursts.forEach((d, i) => {
      if (t >= d && t < d + 0.0095) {
        const u = t - d;
        g = u < 0.001 ? (u / 0.001) * (0.9 - i * 0.05) : (burstEnvs[i] as (t: number) => number)(u);
      }
    });
    return g;
  };
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    out[i] = bp.process(hp.process(whiteNoise(rand))) * gain(t);
  }
  return finish(out, sr, TARGET_PEAK.clap);
}

function renderHat(sr: number, seed: number, open: boolean): Float32Array {
  const name: DrumName = open ? 'ohat' : 'hat';
  const n = Math.ceil(sr * DURATION[name]);
  const out = new Float32Array(n);
  const rand = mulberry32(open ? seed * 19 + 2 : seed * 17 + 1);
  const hp = new Biquad('highpass', sr, open ? 6500 : 7200, 0.5);
  const shine = new Biquad('peaking', sr, open ? 9500 : 10500, 1, open ? 4 : 5);
  const env = open
    ? expEnvelope([[0, 0.0001], [0.002, 1], [0.12, 0.35], [0.5 + seed * 0.03, 0.001]])
    : expEnvelope([[0, 0.0001], [0.001, 1], [0.02, 0.28], [0.085 + seed * 0.008, 0.001]]);
  const metals = [7050, 9320, 11800].map((f) => f * (open ? 1 : 1 + seed * 0.004));
  const phases = [0, 0, 0];
  const level = open ? 0.08 : 0.1;
  const life = open ? 0.7 : 0.2;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let s = whiteNoise(rand);
    if (t < life) {
      for (let k = 0; k < 3; k++) {
        const dt = (metals[k] as number) / sr;
        phases[k] = ((phases[k] as number) + dt) % 1;
        s += oscSample('square', phases[k] as number, dt) * level;
      }
    }
    out[i] = shine.process(hp.process(s)) * env(t);
  }
  return finish(out, sr, TARGET_PEAK[name]);
}

function renderRim(sr: number, seed: number): Float32Array {
  const n = Math.ceil(sr * DURATION.rim);
  const out = new Float32Array(n);
  const rand = mulberry32(seed * 5 + 9);
  const hp = new Biquad('highpass', sr, 3200);
  const tones: Array<[number, number, number]> = [[1700 + seed * 25, 0.5, 0.03], [2550, 0.25, 0.022]];
  const toneEnvs = tones.map(([, a, d]) => expEnvelope([[0, 0.0001], [0.001, a], [d, 0.001]]));
  const woodEnv = expEnvelope([[0, 0.0001], [0.001, 0.5], [0.06, 0.001]]);
  const clickEnv = expEnvelope([[0, 0.5], [0.012, 0.001]]);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let s = 0;
    if (t < 0.1) tones.forEach(([f], k) => { s += Math.sin(2 * Math.PI * f * t) * (toneEnvs[k] as (t: number) => number)(t); });
    if (t < 0.12) s += oscSample('triangle', (480 * t) % 1, 0) * woodEnv(t);
    if (t < 0.05) s += hp.process(whiteNoise(rand)) * clickEnv(t);
    out[i] = s;
  }
  return finish(out, sr, TARGET_PEAK.rim);
}

export function renderDrum(name: DrumName, variant: number, sr: number): Float32Array {
  const seed = variant + 1;
  switch (name) {
    case 'kick':
      return renderKick(sr);
    case 'snare':
      return renderSnare(sr, seed);
    case 'clap':
      return renderClap(sr, seed);
    case 'hat':
      return renderHat(sr, seed, false);
    case 'ohat':
      return renderHat(sr, seed, true);
    case 'rim':
      return renderRim(sr, seed);
  }
}

const cache = new Map<string, Float32Array>();

/** A rendered drum hit. Cached per sample rate; the returned buffer is shared, so never write to it. */
export function drumBuffer(name: DrumName, variant: number, sr: number): Float32Array {
  const v = ((variant % DRUM_VARIANTS[name]) + DRUM_VARIANTS[name]) % DRUM_VARIANTS[name];
  const key = `${name}:${v}:${sr}`;
  let buf = cache.get(key);
  if (!buf) {
    buf = renderDrum(name, v, sr);
    cache.set(key, buf);
  }
  return buf;
}
