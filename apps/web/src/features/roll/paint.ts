/**
 * Canvas drawing for the piano roll. Everything here is a pure function of its arguments (a context, a size,
 * the view and the data), so the component only decides when to draw. Colours come from design tokens through
 * `readColors`; the few numbers below are geometry, not style.
 */
import {
  STEPS_PER_BAR, isBlackKey, isInScale, midiName, pitchToY, stepToX, xToStep, yToPitch, yFromVelocity,
  type Note, type Rect, type RollCursor, type RollView, type ScaleId,
} from '@pro-studio/shared';
import type { CanvasColors } from '../../lib/canvasTheme';

/** How far across a white key a black key reaches. */
const BLACK_KEY_REACH = 0.62;
const HEAD_RADIUS = 3;
/** Space above the loudest bar so its head is not clipped; the lane's pointer maths uses the same value. */
export const LANE_PAD = HEAD_RADIUS + 1;

interface Common {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  view: RollView;
  c: CanvasColors;
}

export interface GridPaint extends Common {
  notes: readonly Note[];
  selected: ReadonlySet<number>;
  /** A resolved CSS colour for the channel (not a token name). */
  color: string;
  total: number;
  keyPc: number;
  scale: ScaleId;
  showScale: boolean;
  /** Keyboard cursor, drawn only while the roll has focus. */
  cursor: (RollCursor & { w: number }) | null;
  marquee: Rect | null;
  fontPx: number;
}

const rowPitches = (view: RollView, h: number): { top: number; bottom: number } => ({ top: yToPitch(0, view), bottom: yToPitch(h, view) });

/** Vertical bar, beat and step lines over a height, shared by the grid and the velocity lane. */
function paintTimeLines({ ctx, w, h, view, c }: Common, total: number, stepLines: boolean): void {
  const first = Math.max(0, Math.floor(xToStep(0, view)));
  const last = Math.min(total, Math.ceil(xToStep(w, view)));
  for (let s = first; s <= last; s++) {
    const bar = s % STEPS_PER_BAR === 0;
    const beat = s % 4 === 0;
    if (!bar && !beat && !(stepLines && view.stepW >= 10)) continue;
    ctx.fillStyle = bar ? c.gridBar : c.trackGrid;
    ctx.globalAlpha = bar || beat ? 1 : 0.5;
    ctx.fillRect(Math.round(stepToX(s, view)), 0, 1, h);
    ctx.globalAlpha = 1;
  }
}

export function paintGrid(g: GridPaint): void {
  const { ctx, w, h, view, c } = g;
  ctx.fillStyle = c.trackA;
  ctx.fillRect(0, 0, w, h);

  // rows: with the scale shown, rows outside it are dimmed and the tonic is tinted; otherwise the black keys are
  const { top, bottom } = rowPitches(view, h);
  for (let p = top; p >= bottom; p--) {
    const y = pitchToY(p, view);
    const pc = ((p % 12) + 12) % 12;
    const dim = g.showScale ? !isInScale(p, g.keyPc, g.scale) : isBlackKey(p);
    if (dim) {
      ctx.fillStyle = c.trackB;
      ctx.fillRect(0, y, w, view.rowH);
    }
    if (g.showScale && pc === g.keyPc) {
      ctx.fillStyle = c.accentSubtle;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(0, y, w, view.rowH);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = pc === 0 ? c.gridBar : c.trackLine;
    ctx.fillRect(0, y + view.rowH - 1, w, 1);
  }

  paintTimeLines(g, g.total, true);

  // past the end of the pattern
  const endX = stepToX(g.total, view);
  if (endX < w) {
    ctx.fillStyle = c.ruler;
    ctx.fillRect(endX, 0, w - endX, h);
    ctx.fillStyle = c.gridBar;
    ctx.fillRect(Math.round(endX), 0, 1, h);
  }

  // notes
  ctx.font = `${g.fontPx}px ${c.fontMono}`;
  ctx.textBaseline = 'middle';
  for (const n of g.notes) {
    const x = stepToX(n.t, view);
    const nw = Math.max(2, n.d * view.stepW - 1);
    const y = pitchToY(n.n, view);
    if (x + nw < 0 || x > w || y + view.rowH < 0 || y > h) continue;
    const isSelected = g.selected.has(n.id);
    ctx.globalAlpha = isSelected ? 1 : 0.55 + n.v * 0.45;
    ctx.fillStyle = g.color;
    ctx.fillRect(x, y + 1, nw, view.rowH - 2);
    ctx.globalAlpha = 1;
    // a dark outline and a bright top edge give the note the bevel the step pads have
    if (nw > 3 && view.rowH >= 8) {
      ctx.strokeStyle = c.ruler;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 1.5, nw - 1, view.rowH - 3);
      ctx.fillStyle = c.text;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(x + 1, y + 2, nw - 2, 1);
      ctx.globalAlpha = 1;
    }
    if (n.s) {
      ctx.fillStyle = c.onChannel;
      ctx.fillRect(x, y + 1, Math.min(3, nw), view.rowH - 2);
    }
    if (isSelected) {
      ctx.strokeStyle = c.text;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 2, Math.max(1, nw - 2), view.rowH - 4);
    }
    if (nw >= g.fontPx * 3 && view.rowH >= g.fontPx + 4) {
      ctx.fillStyle = c.onChannel;
      ctx.textAlign = 'left';
      ctx.fillText(midiName(n.n), x + 5, y + view.rowH / 2);
    }
  }

  if (g.cursor) {
    ctx.strokeStyle = c.focus;
    ctx.lineWidth = 2;
    ctx.strokeRect(stepToX(g.cursor.step, view) + 1, pitchToY(g.cursor.pitch, view) + 1, Math.max(4, g.cursor.w * view.stepW - 2), view.rowH - 2);
  }

  if (g.marquee) {
    const x = Math.min(g.marquee.x1, g.marquee.x2);
    const y = Math.min(g.marquee.y1, g.marquee.y2);
    const mw = Math.abs(g.marquee.x2 - g.marquee.x1);
    const mh = Math.abs(g.marquee.y2 - g.marquee.y1);
    ctx.fillStyle = c.accentSubtle;
    ctx.fillRect(x, y, mw, mh);
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, mw, mh);
  }
}

export function paintRuler({ ctx, w, h, view, c }: Common, total: number, fontPx: number): void {
  // near-black strip with large white bar numbers, as in butterDAWg
  ctx.fillStyle = c.ruler;
  ctx.fillRect(0, 0, w, h);
  ctx.font = `600 ${fontPx + 2}px ${c.fontSans}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const first = Math.max(0, Math.floor(xToStep(0, view)));
  const last = Math.min(total, Math.ceil(xToStep(w, view)));
  for (let s = first; s <= last; s++) {
    const x = Math.round(stepToX(s, view));
    if (s % STEPS_PER_BAR === 0) {
      ctx.fillStyle = c.trackGrid;
      ctx.fillRect(x, 0, 1, h);
      ctx.fillStyle = c.text;
      ctx.fillText(String(s / STEPS_PER_BAR + 1), x + 4, h / 2);
    } else if (s % 4 === 0) {
      ctx.fillStyle = c.trackGrid;
      ctx.fillRect(x, h - Math.round(h * 0.35), 1, Math.round(h * 0.35));
    } else if (view.stepW >= 10) {
      ctx.fillStyle = c.trackGrid;
      ctx.fillRect(x, h - Math.round(h * 0.18), 1, Math.round(h * 0.18));
    }
  }
  ctx.fillStyle = c.trackLine;
  ctx.fillRect(0, h - 1, w, 1);
}

export interface KeysPaint extends Common {
  held: ReadonlySet<number>;
  keyPc: number;
  scale: ScaleId;
  showScale: boolean;
  fontPx: number;
}

export function paintKeys(k: KeysPaint): void {
  const { ctx, w, h, view, c } = k;
  ctx.fillStyle = c.keyWhite;
  ctx.fillRect(0, 0, w, h);
  ctx.font = `${k.fontPx}px ${c.fontMono}`;
  ctx.textBaseline = 'middle';
  const { top, bottom } = rowPitches(view, h);
  const labelAll = view.rowH >= k.fontPx + 6;
  for (let p = top; p >= bottom; p--) {
    const y = pitchToY(p, view);
    const pc = ((p % 12) + 12) % 12;
    const black = isBlackKey(p);
    const down = k.held.has(p);
    if (black) {
      ctx.fillStyle = down ? c.accent : c.keyBlack;
      ctx.fillRect(0, y, w * BLACK_KEY_REACH, view.rowH);
      if (!down) {
        ctx.fillStyle = c.keyBlackText;
        ctx.globalAlpha = 0.25;
        ctx.fillRect(0, y, w * BLACK_KEY_REACH, 1);
        ctx.globalAlpha = 1;
      }
      if (down) {
        ctx.fillStyle = c.accent;
        ctx.fillRect(w * BLACK_KEY_REACH, y, w * (1 - BLACK_KEY_REACH), view.rowH);
        ctx.globalAlpha = 0.35;
        ctx.fillRect(0, y, w, view.rowH);
        ctx.globalAlpha = 1;
      }
    } else {
      if (down) {
        ctx.fillStyle = c.accent;
        ctx.fillRect(0, y, w, view.rowH);
      }
      ctx.fillStyle = c.border;
      ctx.globalAlpha = pc === 0 || pc === 5 ? 1 : 0.35;
      ctx.fillRect(0, y + view.rowH - 1, w, 1);
      ctx.globalAlpha = 1;
      if (pc === 0 || labelAll) {
        ctx.fillStyle = down ? c.onChannel : c.keyWhiteText;
        ctx.textAlign = 'right';
        ctx.fillText(midiName(p), w - 5, y + view.rowH / 2);
      }
    }
    if (k.showScale && isInScale(p, k.keyPc, k.scale)) {
      ctx.fillStyle = black ? c.keyBlackText : c.accent;
      ctx.beginPath();
      ctx.arc(7, y + view.rowH / 2, pc === k.keyPc ? 3 : 1.75, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = c.border;
  ctx.fillRect(w - 1, 0, 1, h);
}

export interface LanePaint extends Common {
  notes: readonly Note[];
  selected: ReadonlySet<number>;
  color: string;
  total: number;
}

export function paintLane(l: LanePaint): void {
  const { ctx, w, h, view, c } = l;
  ctx.fillStyle = c.trackA;
  ctx.fillRect(0, 0, w, h);
  paintTimeLines(l, l.total, false);
  const endX = stepToX(l.total, view);
  if (endX < w) {
    ctx.fillStyle = c.ruler;
    ctx.fillRect(endX, 0, w - endX, h);
  }
  for (const n of l.notes) {
    const x = Math.round(stepToX(n.t, view));
    if (x < -HEAD_RADIUS || x > w + HEAD_RADIUS) continue;
    const y = yFromVelocity(n.v, h - LANE_PAD) + LANE_PAD;
    const isSelected = l.selected.has(n.id);
    ctx.fillStyle = l.color;
    ctx.globalAlpha = isSelected ? 1 : 0.8;
    ctx.fillRect(x - 1, y, 2, h - y);
    ctx.beginPath();
    ctx.arc(x, y, HEAD_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (isSelected) {
      ctx.strokeStyle = c.text;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, HEAD_RADIUS + 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.fillStyle = c.trackLine;
  ctx.fillRect(0, 0, w, 1);
}
