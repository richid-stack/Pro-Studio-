/** Interface state that is not part of the project: what is selected, which tool, snap, which panel is open on a phone. */
import {
  LAYOUT_PRESETS, bringToFront, cascadeLayout, dockAll, dockPanel, fitLayout, floatPanel, sanitizeFloating, setFloatRect, setFolded, setMaximized,
  tileLayout, toggleHidden, type Bounds, type LayoutPresetId, type PanelId, type SnapId, type WindowRect, type WorkspaceLayout,
} from '@pro-studio/shared';
import { createStore, safeStorage, useStore } from './store';

export type RollTool = 'draw' | 'select' | 'erase' | 'pan';

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
        layout: { ...base, browserW: num(l.browserW, base.browserW), rackW: num(l.rackW, base.rackW), topH: num(l.topH, base.topH), mixerH: num(l.mixerH, base.mixerH), hidden: Array.isArray(l.hidden) ? l.hidden : base.hidden, maximized: null, ...sanitizeFloating(l) },
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

  /* ---- floating windows. Each of these is one change to the layout, saved with it. ---- */

  /** The size of the workspace box; the Workspace reports it so menu commands can place windows without measuring. */
  bounds: { width: 1280, height: 720 } as Bounds,
  setBounds(b: Bounds): void {
    workspaceLayout.bounds = b;
  },
  /** Pop a panel out of the dock into a window. */
  float(id: PanelId, rect: WindowRect): void {
    layoutStore.set((s) => ({ ...s, layout: floatPanel(s.layout, id, rect, workspaceLayout.bounds) }));
    persist();
  },
  dock(id: PanelId): void {
    layoutStore.set((s) => ({ ...s, layout: dockPanel(s.layout, id) }));
    persist();
  },
  dockAll(): void {
    layoutStore.set((s) => ({ ...s, layout: dockAll(s.layout) }));
    persist();
  },
  /** Commit a window's new place (called when a drag ends or a key moves it). */
  setRect(id: PanelId, rect: WindowRect): void {
    layoutStore.set((s) => ({ ...s, layout: setFloatRect(s.layout, id, rect, workspaceLayout.bounds) }));
    persist();
  },
  /** Raise a window. Cheap to call on every pointer down: nothing changes when it is already on top. */
  raise(id: PanelId): void {
    layoutStore.set((s) => {
      const layout = bringToFront(s.layout, id);
      return layout === s.layout ? s : { ...s, layout };
    });
    persist();
  },
  fold(id: PanelId, folded: boolean): void {
    layoutStore.set((s) => ({ ...s, layout: setFolded(s.layout, id, folded) }));
    persist();
  },
  cascade(): void {
    layoutStore.set((s) => ({ ...s, layout: cascadeLayout(s.layout, workspaceLayout.bounds) }));
    persist();
  },
  tile(): void {
    layoutStore.set((s) => ({ ...s, layout: tileLayout(s.layout, workspaceLayout.bounds) }));
    persist();
  },
};

export const useLayout = (): WorkspaceLayout => useStore(layoutStore, (s) => s.layout);
export const useLayoutPreset = (): LayoutPresetId => useStore(layoutStore, (s) => s.preset);
