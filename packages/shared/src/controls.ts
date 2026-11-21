/** Maths behind knobs and faders: drag distance to value, and the fader's dB curve. No DOM, so it is tested directly. */
import { clamp } from './theory';

export interface Range {
  min: number;
  max: number;
}

/**
 * New value for a drag of `deltaPx` (up is positive). A full-range sweep takes `travelPx`; holding fine
 * (shift) divides the speed by `fineRatio` so small adjustments are easy.
 */
export function valueFromDrag(start: number, deltaPx: number, range: Range, travelPx = 160, fine = false, fineRatio = 8): number {
  const speed = (range.max - range.min) / travelPx / (fine ? fineRatio : 1);
  return clamp(start + deltaPx * speed, range.min, range.max);
}

/** Step a value by `steps` increments of `step`, rounded so floating-point error never shows in the readout. */
export function stepValue(value: number, steps: number, step: number, range: Range): number {
  const decimals = Math.max(0, Math.ceil(-Math.log10(step)));
  const next = clamp(value + steps * step, range.min, range.max);
  return Number(next.toFixed(decimals + 2));
}

export const FADER_MIN_DB = -60;
export const FADER_MAX_DB = 6;
/** Where 0 dB sits on the fader travel (0 = bottom, 1 = top): a mixer fader spends most of its length near unity. */
const UNITY_POS = 0.78;

/** Fader position 0..1 to dB: -inf..-60 floor at the bottom, 0 dB at 78 % of the travel, +6 dB at the top. */
export function faderToDb(pos: number): number {
  const p = clamp(pos, 0, 1);
  if (p <= 0) return FADER_MIN_DB;
  if (p >= UNITY_POS) return ((p - UNITY_POS) / (1 - UNITY_POS)) * FADER_MAX_DB;
  // below unity: a curve that gives fine control around 0 dB and falls away quickly at the bottom
  const u = p / UNITY_POS;
  return FADER_MIN_DB * (1 - u) ** 1.6;
}

export function dbToFader(db: number): number {
  const d = clamp(db, FADER_MIN_DB, FADER_MAX_DB);
  if (d >= 0) return UNITY_POS + (d / FADER_MAX_DB) * (1 - UNITY_POS);
  if (d <= FADER_MIN_DB) return 0;
  const u = 1 - (d / FADER_MIN_DB) ** (1 / 1.6);
  return u * UNITY_POS;
}

export function formatDb(db: number): string {
  if (db <= FADER_MIN_DB + 0.05) return '-inf';
  const r = Math.round(db * 10) / 10;
  return `${r > 0 ? '+' : ''}${r.toFixed(1)}`;
}

export function formatPan(pan: number): string {
  const p = Math.round(clamp(pan, -1, 1) * 100);
  return p === 0 ? 'C' : p < 0 ? `${-p}L` : `${p}R`;
}

/** Linear peak (0..1+) to a meter position 0..1 on a -60..0 dB scale. */
export function meterPosition(linearPeak: number): number {
  if (linearPeak <= 0.001) return 0;
  return clamp((20 * Math.log10(linearPeak) + 60) / 60, 0, 1);
}

export type GridKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

/** Where focus goes in a rows-by-columns grid of buttons (the step grid) for an arrow key. Stays inside the grid. */
export function gridMove(row: number, col: number, key: string, rows: number, cols: number): { row: number; col: number } | null {
  if (rows <= 0 || cols <= 0) return { row: 0, col: 0 };
  const r = clamp(row, 0, Math.max(0, rows - 1));
  const c = clamp(col, 0, Math.max(0, cols - 1));
  switch (key) {
    case 'ArrowLeft':
      return { row: r, col: Math.max(0, c - 1) };
    case 'ArrowRight':
      return { row: r, col: Math.min(cols - 1, c + 1) };
    case 'ArrowUp':
      return { row: Math.max(0, r - 1), col: c };
    case 'ArrowDown':
      return { row: Math.min(rows - 1, r + 1), col: c };
    case 'Home':
      return { row: r, col: 0 };
    case 'End':
      return { row: r, col: cols - 1 };
    default:
      return null;
  }
}
