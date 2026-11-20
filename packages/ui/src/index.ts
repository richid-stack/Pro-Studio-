/**
 * @forge/ui: design tokens and (soon) the component library.
 * Import the stylesheet once at the app root:  import '@forge/ui/styles/index.css'
 */

/** Names of the 12 channel colours, so UI code never hardcodes a hex. */
export const CHANNEL_COLORS = Array.from({ length: 12 }, (_, i) => `var(--ch-${i + 1})`) as readonly string[];

export type Theme = 'dark' | 'light';
export type Density = 'compact' | 'comfortable';

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme;
}

export function applyDensity(density: Density, root: HTMLElement = document.documentElement): void {
  if (density === 'compact') delete root.dataset.density;
  else root.dataset.density = density;
}
