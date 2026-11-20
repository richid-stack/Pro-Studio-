/**
 * Onset detection for chopping. Two bands: raw energy catches kicks and bass, differenced energy catches
 * snares and hats. Each band's log-energy flux is thresholded adaptively, and the cut is placed at the start
 * of the transient (not where the detector noticed it) on a rising zero crossing so slices do not click.
 */

export interface OnsetOptions {
  /** 0..1. Higher finds more hits. */
  sensitivity: number;
  /** Keep at most this many cuts (the strongest ones). */
  maxCuts: number;
}

const FRAME = 1024;
const HOP = 256;

export function detectOnsets(x: Float32Array, sampleRate: number, opts: OnsetOptions): number[] {
  const sr = sampleRate;
  const sens = Math.min(1, Math.max(0, opts.sensitivity));
  const frames = Math.max(0, Math.floor((x.length - FRAME) / HOP));
  if (frames < 8) return [0];

  const eRaw = new Float32Array(frames);
  const eDiff = new Float32Array(frames);
  let maxRaw = 0;
  let maxDiff = 0;
  for (let f = 0; f < frames; f++) {
    const o = f * HOP;
    let r = 0;
    let d = 0;
    for (let i = 0; i < FRAME; i++) {
      const v = x[o + i] as number;
      const u = v - (o + i > 0 ? (x[o + i - 1] as number) : 0);
      r += v * v;
      d += u * u;
    }
    eRaw[f] = r / FRAME;
    eDiff[f] = d / FRAME;
    if ((eRaw[f] as number) > maxRaw) maxRaw = eRaw[f] as number;
    if ((eDiff[f] as number) > maxDiff) maxDiff = eDiff[f] as number;
  }

  // Ignore movement more than 40 dB under the loudest part (fading 808 tails, hiss).
  const floorRaw = Math.max(1e-9, maxRaw * 1e-4);
  const floorDiff = Math.max(1e-9, maxDiff * 1e-4);
  const flux = new Float32Array(frames);
  for (let f = 1; f < frames; f++) {
    const a = Math.log(floorRaw + (eRaw[f] as number)) - Math.log(floorRaw + (eRaw[f - 1] as number));
    const b = Math.log(floorDiff + (eDiff[f] as number)) - Math.log(floorDiff + (eDiff[f - 1] as number));
    flux[f] = Math.max(0, a, b);
  }

  const sum = new Float64Array(frames + 1);
  const sum2 = new Float64Array(frames + 1);
  for (let f = 0; f < frames; f++) {
    const v = flux[f] as number;
    sum[f + 1] = (sum[f] as number) + v;
    sum2[f + 1] = (sum2[f] as number) + v * v;
  }

  const k = 2.6 - 2.2 * sens;
  const absolute = 1.4 - 1.1 * sens;
  const W = 24;
  const minGap = Math.ceil((0.06 * sr) / HOP);
  const picks: { f: number; s: number }[] = [];
  for (let f = 2; f < frames - 1; f++) {
    const a = Math.max(0, f - W);
    const b = Math.min(frames, f + W);
    const n = b - a;
    const mean = ((sum[b] as number) - (sum[a] as number)) / n;
    const sd = Math.sqrt(Math.max(0, ((sum2[b] as number) - (sum2[a] as number)) / n - mean * mean));
    const v = flux[f] as number;
    if (v > mean + k * sd && v > absolute && v >= (flux[f - 1] as number) && v >= (flux[f + 1] as number)) {
      const last = picks[picks.length - 1];
      if (last && f - last.f < minGap) {
        if (v > last.s) {
          last.f = f;
          last.s = v;
        }
      } else picks.push({ f, s: v });
    }
  }

  let keep = picks;
  if (keep.length > opts.maxCuts) {
    keep = keep
      .slice()
      .sort((p, q) => q.s - p.s)
      .slice(0, opts.maxCuts)
      .sort((p, q) => p.f - q.f);
  }

  const times = keep.map((p) => {
    // The hit entered the window somewhere in its last hop: find where the transient really starts,
    // back off 2 ms, then settle on a rising zero crossing.
    const end = Math.min(x.length - 1, p.f * HOP + FRAME);
    const lo = Math.max(1, end - HOP - Math.floor(0.012 * sr));
    let peak = 0;
    for (let i = lo; i <= end; i++) peak = Math.max(peak, Math.abs(x[i] as number));
    let start = lo;
    for (let i = lo; i <= end; i++) {
      if (Math.abs(x[i] as number) > 0.1 * peak) {
        start = i;
        break;
      }
    }
    let z = Math.max(1, start - Math.floor(0.002 * sr));
    const stop = Math.max(1, z - Math.floor(0.004 * sr));
    for (let i = z; i > stop; i--) {
      if ((x[i - 1] as number) <= 0 && (x[i] as number) > 0) {
        z = i;
        break;
      }
    }
    return z / sr;
  });

  let rms = 0;
  for (let i = 0; i < FRAME; i++) rms += (x[i] as number) ** 2;
  const startsLoud = Math.sqrt(rms / FRAME) > 0.05;
  if (startsLoud && (times.length === 0 || (times[0] as number) > 0.05)) times.unshift(0); // the file starts on a hit
  if (times.length === 0) times.push(0);
  return times.slice(0, opts.maxCuts);
}

/** Evenly spaced cuts: n slices across the clip. */
export const evenCuts = (durationSeconds: number, n: number): number[] =>
  Array.from({ length: n }, (_, i) => (durationSeconds * i) / n);
