/** Interface state that is not part of the project: what is selected, which tool, snap, which panel is open on a phone. */
import { LAYOUT_PRESETS, fitLayout, setMaximized, toggleHidden, type LayoutPresetId, type PanelId, type SnapId, type WorkspaceLayout } from '@pro-studio/shared';
import { createStore, safeStorage, useStore } from './store';

export type RollTool = 'draw' | 'select' | 'erase';

interface UiState {
  selectedChannelId: string | null;
  selectedNotes: ReadonlySet<number>;
  tool: RollTool;
  snap: SnapId;
  /** The one panel shown on narrow screens. */
  mobilePanel: PanelId | 'keys';
  /** A short sentence for screen readers, spoken politely after an action. */
  announcement: string;
  helpOpen: boolean;
}

const ui = createStore<UiState>({
  selectedChannelId: null,
  selectedNotes: new Set(),
  tool: 'draw',
  snap: '1/16',
  mobilePanel: 'rack',
  announcement: '',
  helpOpen: false,
});

export const uiState = {
  store: ui,
  get: (): UiState => ui.get(),
  selectChannel(id: string | null): void {
    ui.set((s) => (s.selectedChannelId === id ? s : { ...s, selectedChannelId: id, selectedNotes: new Set() }));
  },
  selectNotes(ids: Iterable<number>): void {
    ui.set((s) => ({ ...s, selectedNotes: new Set(ids) }));
  },
  setTool: (tool: RollTool): void => ui.set((s) => ({ ...s, tool })),
  setSnap: (snap: SnapId): void => ui.set((s) => ({ ...s, snap })),
  setMobilePanel: (mobilePanel: UiState['mobilePanel']): void => ui.set((s) => ({ ...s, mobilePanel })),
  announce: (announcement: string): void => ui.set((s) => ({ ...s, announcement })),
  setHelp: (helpOpen: boolean): void => ui.set((s) => ({ ...s, helpOpen })),
};

export const useUi = <S>(selector: (s: UiState) => S): S => useStore(ui, selector);

/* ------------------------------------------------------------ layout */

const LAYOUT_KEY = 'prostudio.layout.v1';

function loadLayout(): { preset: LayoutPresetId; layout: WorkspaceLayout } {
  const raw = safeStorage.read(LAYOUT_KEY);
  if (raw) {
    try {
      const o = JSON.parse(raw) as { preset?: LayoutPresetId; layout?: Partial<WorkspaceLayout> };
      const base = LAYOUT_PRESETS[o.preset && o.preset in LAYOUT_PRESETS ? o.preset : 'beat'].layout;
      const l = o.layout ?? {};
      const num = (x: unknown, d: number): number => (typeof x === 'number' && Number.isFinite(x) ? x : d);
      return {
        preset: o.preset && o.preset in LAYOUT_PRESETS ? o.preset : 'beat',
        layout: { ...base, browserW: num(l.browserW, base.browserW), rackW: num(l.rackW, base.rackW), topH: num(l.topH, base.topH), mixerH: num(l.mixerH, base.mixerH), hidden: Array.isArray(l.hidden) ? l.hidden : base.hidden, maximized: null },
      };
    } catch {
      /* fall through to the default */
    }
  }
  return { preset: 'beat', layout: LAYOUT_PRESETS.beat.layout };
}

const layoutStore = createStore(loadLayout());

function persist(): void {
  const { preset, layout } = layoutStore.get();
  safeStorage.write(LAYOUT_KEY, JSON.stringify({ preset, layout: { ...layout, maximized: null } }));
}

export const workspaceLayout = {
  store: layoutStore,
  get: () => layoutStore.get().layout,
  /** Resize a region. The workspace refits sizes to the window when it renders, so a value here may be larger than fits. */
  resize(patch: Partial<Pick<WorkspaceLayout, 'browserW' | 'rackW' | 'topH' | 'mixerH'>>): void {
    layoutStore.set((s) => ({ ...s, layout: { ...s.layout, ...patch } }));
    persist();
  },
  preset(id: LayoutPresetId): void {
    layoutStore.set({ preset: id, layout: LAYOUT_PRESETS[id].layout });
    persist();
  },
  toggle(id: PanelId): void {
    layoutStore.set((s) => ({ ...s, layout: toggleHidden(s.layout, id) }));
    persist();
  },
  maximize(id: PanelId | null): void {
    layoutStore.set((s) => ({ ...s, layout: setMaximized(s.layout, id) }));
  },
  fitted: fitLayout,
};

export const useLayout = (): WorkspaceLayout => useStore(layoutStore, (s) => s.layout);
export const useLayoutPreset = (): LayoutPresetId => useStore(layoutStore, (s) => s.preset);
