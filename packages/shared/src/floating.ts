/**
 * Floating windows as data. A panel is either docked in the grid or floating above it with a rect of its own.
 * Everything here is pure: the UI feeds in pointer deltas and the size of the workspace box, and gets a rect back
 * that already respects each panel's minimum size and keeps the title bar reachable.
 */
import { clamp } from './theory';
import { PANELS, type PanelId, type WindowRect, type WorkspaceLayout } from './workspace';

export interface Size {
  w: number;
  h: number;
}
export interface Bounds {
  width: number;
  height: number;
}
export type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export const EDGES: readonly Edge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

/** The tallest a window's title bar gets (comfortable density). A window can never be dragged below this line. */
export const FLOAT_TITLE_H = 40;
/** How much of a window must stay inside the box horizontally, so there is always something to grab. */
export const FLOAT_GRAB = 72;
/** Pointer travel on a docked panel's title before it pops out into a window. */
export const DETACH_DISTANCE = 8;
/** Keyboard step: 16 px, 64 px with Ctrl. */
export const FLOAT_STEP = 16;
export const FLOAT_STEP_FAST = 64;

export const MIN_FLOAT: Readonly<Record<PanelId, Size>> = {
  browser: { w: 200, h: 200 },
  rack: { w: 360, h: 160 },
  roll: { w: 420, h: 240 },
  playlist: { w: 320, h: 180 },
  mixer: { w: 360, h: 180 },
};

export const DEFAULT_FLOAT: Readonly<Record<PanelId, Size>> = {
  browser: { w: 260, h: 460 },
  rack: { w: 640, h: 300 },
  roll: { w: 760, h: 420 },
  playlist: { w: 700, h: 360 },
  mixer: { w: 760, h: 300 },
};

const round = (n: number): number => Math.round(n);

/** Fit a rect into the box: size within [min, box], position so the title bar stays reachable. */
export function clampRect(r: WindowRect, min: Size, b: Bounds): WindowRect {
  const w = clamp(r.w, min.w, Math.max(min.w, b.width));
  const h = clamp(r.h, min.h, Math.max(min.h, b.height));
  const x = clamp(r.x, FLOAT_GRAB - w, Math.max(FLOAT_GRAB - w, b.width - FLOAT_GRAB));
  const y = clamp(r.y, 0, Math.max(0, b.height - FLOAT_TITLE_H));
  return { x: round(x), y: round(y), w: round(w), h: round(h) };
}

export function moveRect(r: WindowRect, dx: number, dy: number, min: Size, b: Bounds): WindowRect {
  return clampRect({ ...r, x: r.x + dx, y: r.y + dy }, min, b);
}

/**
 * Drag one edge or corner. The opposite side stays where it is, also when the minimum size stops the drag,
 * and the moving side cannot leave the box (unless it already started outside it).
 */
export function resizeRect(r: WindowRect, edge: Edge, dx: number, dy: number, min: Size, b: Bounds): WindowRect {
  let left = r.x;
  let top = r.y;
  let right = r.x + r.w;
  let bottom = r.y + r.h;
  if (edge.includes('w')) left = clamp(r.x + dx, Math.min(0, r.x), right - min.w);
  if (edge.includes('e')) right = clamp(right + dx, left + min.w, Math.max(b.width, r.x + r.w));
  if (edge.includes('n')) top = clamp(r.y + dy, Math.min(0, r.y), bottom - min.h);
  if (edge.includes('s')) bottom = clamp(bottom + dy, top + min.h, Math.max(b.height, r.y + r.h));
  return { x: round(left), y: round(top), w: round(right - left), h: round(bottom - top) };
}

export type ArrowKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';
export const isArrowKey = (key: string): key is ArrowKey => key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown';

/** Arrow keys move a window; with `resize` they move its bottom-right corner instead. Ctrl makes the step four times bigger. */
export function nudgeRect(r: WindowRect, key: ArrowKey, opts: { resize: boolean; fast: boolean }, min: Size, b: Bounds): WindowRect {
  const step = opts.fast ? FLOAT_STEP_FAST : FLOAT_STEP;
  const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
  const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
  return opts.resize ? resizeRect(r, 'se', dx, dy, min, b) : moveRect(r, dx, dy, min, b);
}

/** Where a panel opens when it has no remembered place: its usual size, cascaded from the top-left. */
export function defaultFloatRect(id: PanelId, b: Bounds, index = 0): WindowRect {
  const d = DEFAULT_FLOAT[id];
  const w = Math.min(d.w, Math.round(b.width * 0.9));
  const h = Math.min(d.h, Math.round(b.height * 0.9));
  return clampRect({ x: 24 + 32 * index, y: 16 + 32 * index, w, h }, MIN_FLOAT[id], b);
}

/* ------------------------------------------------------------ layout operations */

export const isFloating = (l: WorkspaceLayout, id: PanelId): boolean => l.floating[id] !== undefined;

const withoutId = (list: readonly PanelId[], id: PanelId): PanelId[] => list.filter((p) => p !== id);
const rest = (m: WorkspaceLayout['floating'], id: PanelId): WorkspaceLayout['floating'] =>
  Object.fromEntries(Object.entries(m).filter(([key]) => key !== id));

/** Pop a panel out of the dock into a window at `rect` (clamped), on top of the others. */
export function floatPanel(l: WorkspaceLayout, id: PanelId, rect: WindowRect, b: Bounds): WorkspaceLayout {
  return {
    ...l,
    floating: { ...l.floating, [id]: clampRect(rect, MIN_FLOAT[id], b) },
    stack: [...withoutId(l.stack, id), id],
    folded: withoutId(l.folded, id),
    hidden: withoutId(l.hidden, id),
    maximized: l.maximized === id ? null : l.maximized,
  };
}

/** Put a window back in the dock. */
export function dockPanel(l: WorkspaceLayout, id: PanelId): WorkspaceLayout {
  return { ...l, floating: rest(l.floating, id), stack: withoutId(l.stack, id), folded: withoutId(l.folded, id) };
}

export function dockAll(l: WorkspaceLayout): WorkspaceLayout {
  return { ...l, floating: {}, stack: [], folded: [] };
}

/** Move or resize a floating window. The rect is clamped; a panel that is not floating is left alone. */
export function setFloatRect(l: WorkspaceLayout, id: PanelId, rect: WindowRect, b: Bounds): WorkspaceLayout {
  if (!isFloating(l, id)) return l;
  return { ...l, floating: { ...l.floating, [id]: clampRect(rect, MIN_FLOAT[id], b) } };
}

/** Raise a window above the others. Returns the same object when it is already on top, so callers can call it freely. */
export function bringToFront(l: WorkspaceLayout, id: PanelId): WorkspaceLayout {
  if (!isFloating(l, id) || l.stack[l.stack.length - 1] === id) return l;
  return { ...l, stack: [...withoutId(l.stack, id), id] };
}

export function setFolded(l: WorkspaceLayout, id: PanelId, folded: boolean): WorkspaceLayout {
  if (!isFloating(l, id) || l.folded.includes(id) === folded) return l;
  return { ...l, folded: folded ? [...l.folded, id] : withoutId(l.folded, id) };
}

/** Floating panels that are shown, back to front. */
export function visibleFloating(l: WorkspaceLayout): PanelId[] {
  return l.stack.filter((id) => isFloating(l, id) && !l.hidden.includes(id));
}

/** Turn every shown panel into a window, stepped diagonally so each title bar stays visible. */
export function cascadeLayout(l: WorkspaceLayout, b: Bounds): WorkspaceLayout {
  const ids = PANELS.filter((id) => !l.hidden.includes(id));
  let next: WorkspaceLayout = { ...l, floating: {}, stack: [], folded: [], maximized: null };
  ids.forEach((id, i) => {
    next = floatPanel(next, id, defaultFloatRect(id, b, i), b);
  });
  return next;
}

/**
 * Turn every shown panel into a window and lay them out in a grid that fills the box. Windows cannot go below their
 * minimum size, so when no grid fits the box this falls back to the cascade rather than let windows overlap.
 */
export function tileLayout(l: WorkspaceLayout, b: Bounds, gap = 8): WorkspaceLayout {
  const ids = PANELS.filter((id) => !l.hidden.includes(id));
  const empty: WorkspaceLayout = { ...l, floating: {}, stack: [], folded: [], maximized: null };
  if (ids.length === 0) return empty;
  const needW = Math.max(...ids.map((id) => MIN_FLOAT[id].w));
  const needH = Math.max(...ids.map((id) => MIN_FLOAT[id].h));
  let best: { columns: number; rows: number; w: number; h: number; score: number } | null = null;
  for (let columns = 1; columns <= ids.length; columns++) {
    const rows = Math.ceil(ids.length / columns);
    const w = Math.floor((b.width - gap * (columns + 1)) / columns);
    const h = Math.floor((b.height - gap * (rows + 1)) / rows);
    if (w < needW || h < needH) continue;
    const score = Math.abs(Math.log(w / h / 1.6)); // cells close to a 16:10 window read best
    if (!best || score < best.score) best = { columns, rows, w, h, score };
  }
  if (!best) return cascadeLayout(l, b);
  const { columns, w, h } = best;
  let next = empty;
  ids.forEach((id, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    next = floatPanel(next, id, { x: gap + col * (w + gap), y: gap + row * (h + gap), w, h }, b);
  });
  return next;
}

/** Keep every window inside the box after the browser window changes size. */
export function fitFloating(l: WorkspaceLayout, b: Bounds): WorkspaceLayout {
  let changed = false;
  const floating: Partial<Record<PanelId, WindowRect>> = {};
  for (const id of PANELS) {
    const r = l.floating[id];
    if (!r) continue;
    const c = clampRect(r, MIN_FLOAT[id], b);
    if (c.x !== r.x || c.y !== r.y || c.w !== r.w || c.h !== r.h) changed = true;
    floating[id] = c;
  }
  return changed ? { ...l, floating } : l;
}

/* ------------------------------------------------------------ saved state */

const isPanel = (x: unknown): x is PanelId => typeof x === 'string' && (PANELS as readonly string[]).includes(x);
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Read the floating part of a saved layout, dropping anything that is not a well-formed window. */
export function sanitizeFloating(raw: unknown): Pick<WorkspaceLayout, 'floating' | 'stack' | 'folded'> {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as { floating?: unknown; stack?: unknown; folded?: unknown };
  const floating: Partial<Record<PanelId, WindowRect>> = {};
  if (typeof o.floating === 'object' && o.floating !== null) {
    for (const id of PANELS) {
      const r = (o.floating as Record<string, unknown>)[id] as Partial<WindowRect> | undefined;
      if (r && finite(r.x) && finite(r.y) && finite(r.w) && finite(r.h) && r.w > 0 && r.h > 0) floating[id] = { x: r.x, y: r.y, w: r.w, h: r.h };
    }
  }
  const list = (x: unknown): PanelId[] => (Array.isArray(x) ? [...new Set(x.filter(isPanel))].filter((id) => floating[id]) : []);
  const stack = list(o.stack);
  for (const id of PANELS) if (floating[id] && !stack.includes(id)) stack.push(id);
  return { floating, stack, folded: list(o.folded) };
}
