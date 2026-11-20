import { ftom } from '@forge/shared';

export interface PitchResult {
  /** Fractional MIDI note, e.g. 57.02 for a slightly sharp A3. */
  midi: number;
  /** 0..1, how periodic the sound is. Below about 0.7 treat the result as a guess. */
  confidence: number;
}

/**
 * YIN pitch detection on the loudest stretch of the clip. Returns null for sounds with no clear pitch
 * (drums, noise) so callers can ask the user instead of guessing.
 */
export function detectPitch(x: Float32Array, sampleRate: number): PitchResult | null {
  const sr = sampleRate;
  const W = 4096;
  const half = W / 2;
  if (x.length < W) return null;

  let best = 0;
  let at = 0;
  const limit = Math.min(x.length - W, Math.floor(sr * 3));
  for (let s = 0; s <= limit; s += 1024) {
    let e = 0;
    for (let i = 0; i < W; i += 4) e += (x[s + i] as number) ** 2;
    if (e > best) {
      best = e;
      at = s;
    }
  }
  if (best < 1e-4) return null;

  const tauMin = Math.max(2, Math.floor(sr / 2000));
  const tauMax = Math.min(half - 1, Math.floor(sr / 28));
  const diff = new Float32Array(tauMax + 2);
  const cmnd = new Float32Array(tauMax + 2);
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let i = 0; i < half; i++) {
      const v = (x[at + i] as number) - (x[at + i + tau] as number);
      s += v * v;
    }
    diff[tau] = s;
  }
  let running = 0;
  cmnd[0] = 1;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += diff[tau] as number;
    cmnd[tau] = running ? ((diff[tau] as number) * tau) / running : 1;
  }

  let tau = -1;
  for (let t = tauMin; t < tauMax; t++) {
    if ((cmnd[t] as number) < 0.15) {
      while (t + 1 < tauMax && (cmnd[t + 1] as number) < (cmnd[t] as number)) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) {
    let m = 9;
    for (let t = tauMin; t < tauMax; t++) {
      if ((cmnd[t] as number) < m) {
        m = cmnd[t] as number;
        tau = t;
      }
    }
    if (m > 0.4) return null;
  }

  const a = cmnd[tau - 1] as number;
  const b = cmnd[tau] as number;
  const c = cmnd[tau + 1] as number;
  const denom = a - 2 * b + c;
  const offset = denom ? (0.5 * (a - c)) / denom : 0;
  return { midi: ftom(sr / (tau + offset)), confidence: 1 - b };
}
