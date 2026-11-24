/**
 * Pro Studio's icons. Every glyph is drawn here, on a 20-unit grid with a 2-unit safe margin.
 *
 * The house style is two-tone: a solid shape carries the meaning and a quieter tone shape (the same colour at
 * `--icon-tone-opacity`) gives it body, so an icon reads at 16px and still looks designed at 24px. Corners are
 * rounded, strokes are 1.75 wide with round caps, and any glyph that is "a thing" (a pad, a fader, a folder)
 * is filled; any glyph that is "an action" (undo, close, chevron) is a line.
 *
 * Layers, painted in order:
 *   f  solid fill            t  tone fill            l  line            m  tone line
 *   s  solid fill with a round-joined stroke (soft-cornered solid shapes: play, stop, pause)
 *
 * Icons are decoration: the control that holds one carries the accessible name.
 */
export type IconName =
  | 'play' | 'pause' | 'stop' | 'undo' | 'redo' | 'plus' | 'minus' | 'close' | 'maximize' | 'restore' | 'minimize' | 'float' | 'dock' | 'chevron' | 'check'
  | 'search' | 'speaker' | 'more' | 'keys' | 'draw' | 'select' | 'erase' | 'pan' | 'sun' | 'moon' | 'zoom-time' | 'zoom-pitch'
  | 'folder' | 'folder-open' | 'project' | 'drum' | 'wave' | 'note' | 'beat' | 'star' | 'star-fill' | 'collapse'
  | 'save' | 'export' | 'help' | 'metronome' | 'loop' | 'record' | 'caret' | 'window-browser' | 'window-rack' | 'window-roll' | 'window-playlist' | 'window-mixer';

type Kind = 'f' | 't' | 'l' | 'm' | 's';

interface Layer {
  d: string;
  k: Kind;
  /** Stroke width for l, m and s layers. Defaults come from the stylesheet. */
  w?: number;
}

interface Glyph {
  layers: Layer[];
  /** Draw the glyph flipped left to right (redo is undo, mirrored). */
  mirror?: boolean;
}

/* ----------------------------------------------------------------- path helpers */

const n = (v: number) => String(Math.round(v * 100) / 100);

/** A rounded rectangle. */
const rr = (x: number, y: number, w: number, h: number, r = 0.8) =>
  `M${n(x + r)} ${n(y)}h${n(w - 2 * r)}a${r} ${r} 0 0 1 ${r} ${r}v${n(h - 2 * r)}a${r} ${r} 0 0 1-${r} ${r}h${n(-(w - 2 * r))}a${r} ${r} 0 0 1-${r}-${r}v${n(-(h - 2 * r))}a${r} ${r} 0 0 1 ${r}-${r}z`;

/** A circle. */
const dot = (cx: number, cy: number, r: number) => `M${n(cx - r)} ${n(cy)}a${r} ${r} 0 1 0 ${n(2 * r)} 0a${r} ${r} 0 1 0 ${n(-2 * r)} 0z`;

/** A grid of small rounded squares: the cells in `lit` are solid, the rest are tone. */
function cells(cols: number, rows: number, x0: number, y0: number, size: number, gap: number, lit: ReadonlyArray<readonly [number, number]>): Layer[] {
  const on: string[] = [];
  const off: string[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const d = rr(x0 + c * (size + gap), y0 + r * (size + gap), size, size, 0.7);
      (lit.some(([lc, lr]) => lc === c && lr === r) ? on : off).push(d);
    }
  }
  return [{ d: off.join(''), k: 't' }, { d: on.join(''), k: 'f' }];
}

const STAR = 'M10 3.2L11.82 7.89L16.85 8.18L12.95 11.36L14.23 16.22L10 13.5L5.77 16.22L7.05 11.36L3.15 8.18L8.18 7.89z';

const GLYPHS: Record<IconName, Glyph> = {
  /* transport */
  play: { layers: [{ d: 'M7 4.8v10.4L15.2 10z', k: 's', w: 2 }] },
  pause: { layers: [{ d: 'M5.8 5h2.4v10H5.8zM11.8 5h2.4v10h-2.4z', k: 's', w: 1.8 }] },
  stop: { layers: [{ d: 'M5.6 5.6h8.8v8.8H5.6z', k: 's', w: 2 }] },
  undo: { layers: [{ d: 'M7.5 4 3.8 7.7l3.7 3.7', k: 'l' }, { d: 'M4 7.7h7.6a4.5 4.5 0 0 1 0 9H8', k: 'l' }] },
  redo: { layers: [{ d: 'M7.5 4 3.8 7.7l3.7 3.7', k: 'l' }, { d: 'M4 7.7h7.6a4.5 4.5 0 0 1 0 9H8', k: 'l' }], mirror: true },

  /* actions */
  plus: { layers: [{ d: 'M10 4.5v11M4.5 10h11', k: 'l' }] },
  minus: { layers: [{ d: 'M4.5 10h11', k: 'l' }] },
  close: { layers: [{ d: 'M5.2 5.2l9.6 9.6M14.8 5.2l-9.6 9.6', k: 'l' }] },
  maximize: { layers: [{ d: 'M3.8 7.8V4.8a1 1 0 0 1 1-1h3M16.2 7.8V4.8a1 1 0 0 0-1-1h-3M3.8 12.2v3a1 1 0 0 0 1 1h3M16.2 12.2v3a1 1 0 0 1-1 1h-3', k: 'l' }] },
  restore: { layers: [{ d: 'M7.8 3.8v3a1 1 0 0 1-1 1h-3M12.2 3.8v3a1 1 0 0 0 1 1h3M7.8 16.2v-3a1 1 0 0 0-1-1h-3M12.2 16.2v-3a1 1 0 0 1 1-1h3', k: 'l' }] },
  /* window controls: fold to the title bar, pop out of the dock, snap back in */
  minimize: { layers: [{ d: rr(4.5, 12.6, 11, 3.2, 1), k: 't' }, { d: 'M4.5 14.2h11', k: 'l', w: 2.2 }] },
  float: {
    layers: [
      { d: rr(3.5, 7, 9.5, 9.5, 1.4), k: 't' },
      { d: 'M13 11.8v2.6a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2H8', k: 'l' },
      { d: 'M10.6 9.4l5.9-5.9M11.6 3.5h4.9v4.9', k: 'l' },
    ],
  },
  dock: {
    layers: [
      { d: rr(3, 3.5, 14, 13, 1.6), k: 'l' },
      { d: rr(5.6, 6.2, 8.8, 7.6, 1), k: 't' },
      { d: rr(5.6, 6.2, 8.8, 2.6, 1), k: 'f' },
    ],
  },
  chevron: { layers: [{ d: 'M5.5 8l4.5 4.5L14.5 8', k: 'l' }] },
  collapse: { layers: [{ d: 'M5.5 9.2L10 4.7l4.5 4.5', k: 'l' }, { d: 'M5.5 15.2l4.5-4.5 4.5 4.5', k: 'm' }] },
  check: { layers: [{ d: 'M4.5 10.5l3.6 3.6 7.4-8.2', k: 'l' }] },
  search: { layers: [{ d: dot(8.6, 8.6, 5.2), k: 't' }, { d: dot(8.6, 8.6, 5.2), k: 'l' }, { d: 'M12.5 12.5l4 4', k: 'l', w: 2.2 }] },
  more: { layers: [{ d: dot(4.5, 10, 1.5) + dot(10, 10, 1.5) + dot(15.5, 10, 1.5), k: 'f' }] },
  speaker: {
    layers: [
      { d: 'M3 7.8h2.8l4.3-3.5a.5.5 0 0 1 .8.4v10.6a.5.5 0 0 1-.8.4l-4.3-3.5H3z', k: 's', w: 1 },
      { d: 'M13.4 7.6a3.5 3.5 0 0 1 0 4.8', k: 'l' },
      { d: 'M15.6 5.4a6.6 6.6 0 0 1 0 9.2', k: 'm' },
    ],
  },

  /* piano roll tools */
  draw: {
    layers: [
      { d: 'M3.6 16.4l.9-3.7 8.4-8.4a1.6 1.6 0 0 1 2.3 0l.5.5a1.6 1.6 0 0 1 0 2.3l-8.4 8.4z', k: 't' },
      { d: 'M3.6 16.4l.9-3.7 8.4-8.4a1.6 1.6 0 0 1 2.3 0l.5.5a1.6 1.6 0 0 1 0 2.3l-8.4 8.4z', k: 'l', w: 1.5 },
      { d: 'M11.4 5.8l2.8 2.8', k: 'l', w: 1.5 },
      { d: 'M3.6 16.4l.9-3.7 2.8 2.8z', k: 'f' },
    ],
  },
  select: {
    layers: [
      { d: rr(7, 7, 6, 6, 0.8), k: 'f' },
      { d: 'M3.8 7.2V5a1.2 1.2 0 0 1 1.2-1.2h2.2M12.8 3.8H15a1.2 1.2 0 0 1 1.2 1.2v2.2M16.2 12.8V15a1.2 1.2 0 0 1-1.2 1.2h-2.2M7.2 16.2H5A1.2 1.2 0 0 1 3.8 15v-2.2', k: 'l' },
    ],
  },
  erase: {
    layers: [
      { d: 'M3.8 11.9 11 4.7a1.5 1.5 0 0 1 2.1 0l2.9 2.9a1.5 1.5 0 0 1 0 2.1l-7 7H6.4z', k: 't' },
      { d: 'M3.8 11.9 11 4.7a1.5 1.5 0 0 1 2.1 0l2.9 2.9a1.5 1.5 0 0 1 0 2.1l-7 7H6.4z', k: 'l', w: 1.5 },
      { d: 'M3.8 11.9 8.6 16.7H6.4l-2.6-2.6z', k: 'f' },
      { d: 'M9.2 7.4l5 5', k: 'l', w: 1.5 },
      { d: 'M10.6 16.7h5.6', k: 'l', w: 1.5 },
    ],
  },
  pan: {
    layers: [
      { d: 'M10 5.5v9M5.5 10h9', k: 'l' },
      { d: 'M10 2.4l2.7 3.1H7.3zM10 17.6l2.7-3.1H7.3zM2.4 10l3.1-2.7v5.4zM17.6 10l-3.1-2.7v5.4z', k: 's', w: 0.8 },
    ],
  },
  'zoom-time': { layers: [{ d: 'M5.5 10h9', k: 'l' }, { d: 'M2.4 10l3.4-3.2v6.4zM17.6 10l-3.4-3.2v6.4z', k: 's', w: 0.8 }] },
  'zoom-pitch': { layers: [{ d: 'M10 5.5v9', k: 'l' }, { d: 'M10 2.4l3.2 3.4H6.8zM10 17.6l3.2-3.4H6.8z', k: 's', w: 0.8 }] },

  /* appearance */
  sun: {
    layers: [
      { d: dot(10, 10, 3.6), k: 'f' },
      { d: 'M10 2.6v2M10 15.4v2M2.6 10h2M15.4 10h2M4.8 4.8l1.4 1.4M13.8 13.8l1.4 1.4M4.8 15.2l1.4-1.4M13.8 6.2l1.4-1.4', k: 'l' },
    ],
  },
  moon: {
    layers: [
      { d: 'M15.9 12.3A6.6 6.6 0 0 1 7.7 4.1a6.6 6.6 0 1 0 8.2 8.2z', k: 's', w: 1.2 },
      { d: 'M13.6 3.6v2.4M12.4 4.8h2.4', k: 'm', w: 1.4 },
    ],
  },

  /* files */
  folder: {
    layers: [
      { d: 'M2.5 5.6A1.6 1.6 0 0 1 4.1 4h3.4a1.6 1.6 0 0 1 1.2.5L10 6h5.9a1.6 1.6 0 0 1 1.6 1.6v6.8A1.6 1.6 0 0 1 15.9 16H4.1a1.6 1.6 0 0 1-1.6-1.6z', k: 't' },
      { d: rr(2.5, 7.4, 15, 8.6, 1.6), k: 'f' },
    ],
  },
  'folder-open': {
    layers: [
      { d: 'M2.5 14.4V5.6A1.6 1.6 0 0 1 4.1 4h3.4a1.6 1.6 0 0 1 1.2.5L10 6h5.9a1.6 1.6 0 0 1 1.6 1.6V9H2.5z', k: 't' },
      { d: 'M5.6 8.8h11.6l-2 7.1H3.4z', k: 's', w: 1.4 },
    ],
  },
  project: {
    layers: [
      { d: 'M5.6 2.5h5.9l4.9 4.9v9.1a1.2 1.2 0 0 1-1.2 1.2H5.6a1.2 1.2 0 0 1-1.2-1.2V3.7a1.2 1.2 0 0 1 1.2-1.2z', k: 't' },
      { d: 'M11.5 2.5v3.8a1.1 1.1 0 0 0 1.1 1.1h3.8z', k: 'f' },
      { d: 'M7.2 11.2h5.6M7.2 14h5.6', k: 'l', w: 1.5 },
    ],
  },
  save: {
    layers: [
      { d: 'M4.5 2.5h9.3l3.7 3.7v9.3a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2z', k: 't' },
      { d: 'M6 2.5h6v3.9a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z', k: 'f' },
      { d: 'M5.5 17.5v-4.2a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v4.2z', k: 'f' },
    ],
  },
  export: {
    layers: [
      { d: 'M3.5 11.5v3.2a1.8 1.8 0 0 0 1.8 1.8h9.4a1.8 1.8 0 0 0 1.8-1.8v-3.2', k: 'l' },
      { d: 'M10 12V4.6', k: 'l' },
      { d: 'M10 2.6l3.8 4.1H6.2z', k: 's', w: 1 },
    ],
  },
  help: {
    layers: [
      { d: dot(10, 10, 7.5), k: 't' },
      { d: 'M7.9 8.1a2.1 2.1 0 1 1 3.4 1.7c-.9.7-1.3 1.1-1.3 2', k: 'l' },
      { d: dot(10, 14.2, 1.05), k: 'f' },
    ],
  },
  metronome: {
    layers: [
      { d: 'M7.4 3h5.2l2.6 13.5a1 1 0 0 1-1 1.2H5.8a1 1 0 0 1-1-1.2z', k: 't' },
      { d: 'M10 14.6 12.7 5.4', k: 'l', w: 1.6 },
      { d: rr(10.4, 7.2, 3.4, 2, 0.6), k: 'f' },
      { d: 'M7.4 3h5.2l2.6 13.5a1 1 0 0 1-1 1.2H5.8a1 1 0 0 1-1-1.2z', k: 'l', w: 1.4 },
    ],
  },
  loop: {
    layers: [
      { d: 'M5 9V8.2A3.2 3.2 0 0 1 8.2 5h6.3M15 11v.8a3.2 3.2 0 0 1-3.2 3.2H5.5', k: 'l' },
      { d: 'M14.4 2.5l3.2 2.5-3.2 2.5zM5.6 12.5 2.4 15l3.2 2.5z', k: 's', w: 0.8 },
    ],
  },
  record: { layers: [{ d: dot(10, 10, 5.4), k: 'f' }] },
  caret: { layers: [{ d: 'M6 8.2h8L10 13z', k: 's', w: 0.9 }] },
  star: { layers: [{ d: STAR, k: 'l', w: 1.5 }] },
  'star-fill': { layers: [{ d: STAR, k: 's', w: 1.4 }] },

  /* things in the project */
  keys: {
    layers: [
      { d: rr(2.5, 4, 15, 12, 1.6), k: 't' },
      { d: rr(2.5, 4, 15, 12, 1.6), k: 'l', w: 1.5 },
      { d: 'M7.5 10.5V16M12.5 10.5V16', k: 'l', w: 1.5 },
      { d: rr(6.2, 4, 2.6, 6.5, 0.6) + rr(11.2, 4, 2.6, 6.5, 0.6), k: 'f' },
    ],
  },
  drum: { layers: [{ d: rr(3, 3, 14, 14, 2.4), k: 't' }, { d: dot(10, 10, 3.6), k: 'f' }] },
  wave: {
    layers: [
      { d: 'M3.4 8.6v2.8M16.6 8.6v2.8', k: 'm', w: 1.9 },
      { d: 'M6.7 5.6v8.8M13.3 5.6v8.8', k: 'l', w: 1.9 },
      { d: 'M10 3.2v13.6', k: 'l', w: 1.9 },
    ],
  },
  note: {
    layers: [
      { d: 'M8.4 14.2V5.6L16.2 3.8V12', k: 'l', w: 1.5 },
      { d: 'M8.4 5.6 16.2 3.8v2.7L8.4 8.3z', k: 'f' },
      { d: dot(6.2, 14.4, 2.3) + dot(14, 12.2, 2.3), k: 'f' },
    ],
  },
  beat: { layers: cells(4, 2, 2.1, 5.4, 3.2, 1, [[0, 0], [2, 0], [1, 1], [3, 1]]) },

  /* window toggles in the top bar: each one is a miniature of the panel it opens */
  'window-browser': {
    layers: [
      { d: 'M5.6 6.1v8.4h2.2M5.6 10.4h2.2', k: 'm', w: 1.5 },
      { d: rr(2.4, 3.2, 4.4, 3.4, 0.9) + rr(8.4, 8.6, 4.4, 3.4, 0.9) + rr(8.4, 13.4, 4.4, 3.4, 0.9), k: 'f' },
      { d: 'M9 4.9h8M14.2 10.3h2.8M14.2 15.1h2.8', k: 'l', w: 1.6 },
    ],
  },
  'window-rack': { layers: cells(4, 3, 2.1, 3.9, 3.2, 1, [[0, 0], [2, 0], [1, 1], [3, 1], [0, 2], [2, 2]]) },
  'window-roll': {
    layers: [
      { d: rr(2.4, 3, 4, 14, 1), k: 't' },
      { d: rr(2.4, 5, 2.6, 2.2, 0.5) + rr(2.4, 9, 2.6, 2.2, 0.5) + rr(2.4, 13, 2.6, 2.2, 0.5), k: 'f' },
      { d: 'M9.6 5.6h3.8M12.6 10h4.6M8.6 14.4h3.4', k: 'l', w: 2.6 },
    ],
  },
  'window-playlist': {
    layers: [
      { d: rr(2.4, 3.4, 3.4, 3.2, 0.8) + rr(2.4, 8.4, 3.4, 3.2, 0.8) + rr(2.4, 13.4, 3.4, 3.2, 0.8), k: 't' },
      { d: rr(7.6, 3.4, 5.8, 3.2, 0.8) + rr(10.6, 8.4, 7, 3.2, 0.8) + rr(7.6, 13.4, 4.2, 3.2, 0.8), k: 'f' },
      { d: rr(14.4, 3.4, 3.2, 3.2, 0.8) + rr(13, 13.4, 4.6, 3.2, 0.8), k: 't' },
    ],
  },
  'window-mixer': {
    layers: [
      { d: 'M4.8 3.5v13M10 3.5v13M15.2 3.5v13', k: 'm', w: 2 },
      { d: rr(2.6, 9, 4.4, 3.2, 0.9) + rr(7.8, 4.4, 4.4, 3.2, 0.9) + rr(13, 11.6, 4.4, 3.2, 0.9), k: 'f' },
    ],
  },
};

export function Icon({ name, size = 'md' }: { name: IconName; size?: 'sm' | 'md' | 'lg' }) {
  const g = GLYPHS[name];
  const layers = g.layers.map((l, i) => <path key={i} className={`icon-${l.k}`} d={l.d} style={l.w === undefined ? undefined : { strokeWidth: l.w }} />);
  return (
    <svg className="icon" data-size={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {g.mirror ? <g transform="matrix(-1 0 0 1 20 0)">{layers}</g> : layers}
    </svg>
  );
}

/** Every icon name, for the contact sheet and tests. */
export const ICON_NAMES = Object.keys(GLYPHS) as IconName[];
