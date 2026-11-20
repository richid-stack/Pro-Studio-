export interface LoopPoints {
  /** Loop start and end, in seconds. */
  start: number;
  end: number;
}

/**
 * Find a loop for a held tone: start on a rising zero crossing about a third of the way in, then pick the end
 * (in the last quarter) whose waveform shape best matches the start, so the phase lines up on repeat.
 * Playback should still crossfade the seam, because a decaying note is quieter at the end than the start.
 * Returns null when the clip is too short to loop.
 */
export function findLoop(x: Float32Array, sampleRate: number): LoopPoints | null {
  const sr = sampleRate;
  const n = x.length;
  if (n / sr < 0.3) return null;

  let ls = Math.floor(n * 0.35);
  while (ls < n - 2 && !((x[ls - 1] as number) <= 0 && (x[ls] as number) > 0)) ls++;

  const win = Math.floor(0.012 * sr);
  const rms = (at: number): number => {
    let e = 0;
    for (let i = 0; i < win; i++) e += (x[at + i] as number) ** 2;
    return Math.sqrt(e / win) || 1e-9;
  };
  const startRms = rms(ls);
  let best = Number.POSITIVE_INFINITY;
  let le = -1;
  const last = Math.floor(n * 0.97) - win;
  for (let e = Math.floor(n * 0.75); e < last; e++) {
    if (!((x[e - 1] as number) <= 0 && (x[e] as number) > 0)) continue;
    // Compare shapes, not loudness: a fading note is always a little quieter at the end, and that
    // difference is fixed with a crossfade at playback, not by choosing a worse phase match.
    const endRms = rms(e);
    let s = 0;
    for (let i = 0; i < win; i++) {
      const v = (x[ls + i] as number) / startRms - (x[e + i] as number) / endRms;
      s += v * v;
    }
    if (s < best) {
      best = s;
      le = e;
    }
  }
  return le > ls ? { start: ls / sr, end: le / sr } : null;
}
