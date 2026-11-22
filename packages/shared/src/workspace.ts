/**
 * The dockable workspace as data: which panels exist, how big each region is, which one is maximized.
 * Sizes are stored as numbers (pixels) and clamped against the space actually available, so a layout saved
 * on a big monitor opens sensibly on a laptop.
 */
import { clamp } from './theory';

export type PanelId = 'browser' | 'rack' | 'roll' | 'playlist' | 'mixer';
export const PANELS: readonly PanelId[] = ['browser', 'rack', 'roll', 'playlist', 'mixer'];

export const PANEL_LABELS: Readonly<Record<PanelId, string>> = {
  browser: 'Browser',
  rack: 'Channel rack',
  roll: 'Piano roll',
  playlist: 'Playlist',
  mixer: 'Mixer',
};

export interface WorkspaceLayout {
  /** Width of the browser column, px. */
  browserW: number;
  /** Width of the channel rack within the top row, px. */
  rackW: number;
  /** Height of the top row (rack + playlist), px. */
  topH: number;
  /** Height of the mixer, px. */
  mixerH: number;
  hidden: readonly PanelId[];
  maximized: PanelId | null;
}

export type LayoutPresetId = 'beat' | 'arrange' | 'mix' | 'perform';

export const LAYOUT_PRESETS: Readonly<Record<LayoutPresetId, { label: string; layout: WorkspaceLayout }>> = {
  beat: { label: 'Beat', layout: { browserW: 232, rackW: 600, topH: 208, mixerH: 196, hidden: [], maximized: null } },
  arrange: { label: 'Arrange', layout: { browserW: 200, rackW: 400, topH: 420, mixerH: 150, hidden: [], maximized: null } },
  mix: { label: 'Mix', layout: { browserW: 200, rackW: 360, topH: 190, mixerH: 400, hidden: [], maximized: null } },
  perform: { label: 'Perform', layout: { browserW: 232, rackW: 600, topH: 150, mixerH: 150, hidden: ['playlist'], maximized: null } },
};

export const MIN_BROWSER_W = 160;
export const MAX_BROWSER_W = 420;
export const MIN_RACK_W = 300;
export const MIN_PLAYLIST_W = 220;
export const MIN_TOP_H = 120;
export const MIN_ROLL_H = 160;
export const MIN_MIXER_H = 110;
export const SPLITTER = 6;

export interface Viewport {
  width: number;
  height: number;
  /** Height of the transport bar above the workspace. */
  barH: number;
}

/** Fit a layout to the space available, keeping every panel at least its minimum size. */
export function fitLayout(l: WorkspaceLayout, vp: Viewport): WorkspaceLayout {
  const browserW = l.hidden.includes('browser') ? 0 : clamp(l.browserW, MIN_BROWSER_W, Math.min(MAX_BROWSER_W, vp.width * 0.4));
  const stageW = vp.width - browserW - (browserW > 0 ? SPLITTER : 0);
  const showPlaylist = !l.hidden.includes('playlist');
  const rackW = clamp(l.rackW, MIN_RACK_W, Math.max(MIN_RACK_W, showPlaylist ? stageW - MIN_PLAYLIST_W - SPLITTER : stageW));
  const stageH = vp.height - vp.barH;
  const mixerH = l.hidden.includes('mixer') ? 0 : clamp(l.mixerH, MIN_MIXER_H, Math.max(MIN_MIXER_H, stageH - MIN_TOP_H - MIN_ROLL_H - 2 * SPLITTER));
  const room = stageH - mixerH - (mixerH > 0 ? SPLITTER : 0) - SPLITTER;
  const topH = clamp(l.topH, MIN_TOP_H, Math.max(MIN_TOP_H, room - MIN_ROLL_H));
  return { ...l, browserW, rackW, topH, mixerH };
}

export function toggleHidden(l: WorkspaceLayout, id: PanelId): WorkspaceLayout {
  const hidden = l.hidden.includes(id) ? l.hidden.filter((p) => p !== id) : [...l.hidden, id];
  return { ...l, hidden, maximized: l.maximized === id && hidden.includes(id) ? null : l.maximized };
}

export function setMaximized(l: WorkspaceLayout, id: PanelId | null): WorkspaceLayout {
  return { ...l, maximized: l.maximized === id ? null : id, hidden: id ? l.hidden.filter((p) => p !== id) : l.hidden };
}

/** Narrow screens show one panel at a time. */
export const MOBILE_BREAKPOINT = 768;
export const isMobileWidth = (width: number): boolean => width < MOBILE_BREAKPOINT;

/** Keyboard step for a splitter: 16 px, 64 px with shift. */
export const splitterStep = (shift: boolean): number => (shift ? 64 : 16);
