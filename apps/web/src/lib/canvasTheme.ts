/**
 * Canvas drawing cannot use CSS variables directly, so colours and sizes are read from the design tokens at the
 * moment of drawing. Nothing here is a literal: change a token and the canvases follow, in both themes.
 */
export interface CanvasColors {
  surface: string;
  surfaceRaised: string;
  rowBlack: string;
  gridBar: string;
  gridBeat: string;
  gridStep: string;
  text: string;
  textMuted: string;
  accent: string;
  accentSubtle: string;
  playhead: string;
  keyWhite: string;
  keyWhiteText: string;
  keyBlack: string;
  keyBlackText: string;
  focus: string;
  onChannel: string;
  border: string;
  fontMono: string;
}

export function readColors(el: Element): CanvasColors {
  const css = getComputedStyle(el);
  const get = (name: string): string => css.getPropertyValue(name).trim();
  return {
    surface: get('--surface-inset'),
    surfaceRaised: get('--surface-2'),
    rowBlack: get('--row-black-key'),
    gridBar: get('--grid-bar'),
    gridBeat: get('--grid-beat'),
    gridStep: get('--grid-step'),
    text: get('--text-primary'),
    textMuted: get('--text-muted'),
    accent: get('--accent'),
    accentSubtle: get('--accent-subtle'),
    playhead: get('--playhead'),
    keyWhite: get('--key-white'),
    keyWhiteText: get('--key-white-text'),
    keyBlack: get('--key-black'),
    keyBlackText: get('--key-black-text'),
    focus: get('--focus-ring'),
    onChannel: get('--text-on-channel'),
    border: get('--border-strong'),
    fontMono: get('--font-mono'),
  };
}

/** The colour of a channel token such as "ch-3". */
export function channelColorValue(el: Element, token: string): string {
  return getComputedStyle(el).getPropertyValue(`--${token}`).trim();
}

/** A length token such as --space-2 or --text-xs, in CSS pixels. Measured, not parsed, so rem and calc both work. */
export function lengthToken(host: HTMLElement, token: string): number {
  const probe = document.createElement('div');
  probe.style.cssText = `position:absolute;visibility:hidden;width:var(${token});height:0`;
  host.appendChild(probe);
  const px = probe.getBoundingClientRect().width;
  probe.remove();
  return px;
}

/** Size a canvas to its box at the screen's pixel density and return its 2D context, already scaled to CSS pixels. */
export function fitCanvas(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D | null {
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const w = Math.max(1, Math.round(width * dpr));
  const h = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
