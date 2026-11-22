/**
 * What the browser panel remembers: the tab, the stars, which folders are open and whether clicking a sound
 * previews it. The search words, tag filters and the active row are not kept between visits.
 */
import { DEFAULT_EXPANDED, isBrowserTab, toggleInSet, type BrowserTab } from '@pro-studio/shared';
import { createStore, safeStorage, useStore } from './store';

export interface BrowserState {
  tab: BrowserTab;
  text: string;
  tags: readonly string[];
  starred: readonly string[];
  expanded: readonly string[];
  autoPreview: boolean;
  active: string | null;
}

const KEY = 'prostudio.browser.v1';

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function load(): BrowserState {
  const base: BrowserState = { tab: 'all', text: '', tags: [], starred: [], expanded: DEFAULT_EXPANDED, autoPreview: true, active: null };
  const raw = safeStorage.read(KEY);
  if (!raw) return base;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    return {
      ...base,
      tab: isBrowserTab(o.tab) ? o.tab : base.tab,
      starred: strings(o.starred),
      expanded: Array.isArray(o.expanded) ? strings(o.expanded) : base.expanded,
      autoPreview: o.autoPreview !== false,
    };
  } catch {
    return base;
  }
}

const store = createStore<BrowserState>(load());

store.subscribe(() => {
  const { tab, starred, expanded, autoPreview } = store.get();
  safeStorage.write(KEY, JSON.stringify({ tab, starred, expanded, autoPreview }));
});

export const browserState = {
  get: store.get,
  set: (patch: Partial<BrowserState>): void => store.set((s) => ({ ...s, ...patch })),
  toggleStar: (id: string): boolean => {
    const on = !store.get().starred.includes(id);
    store.set((s) => ({ ...s, starred: [...toggleInSet(new Set(s.starred), id, on)] }));
    return on;
  },
  setOpen: (id: string, open: boolean): void => store.set((s) => ({ ...s, expanded: [...toggleInSet(new Set(s.expanded), id, open)] })),
  collapseAll: (): void => store.set((s) => ({ ...s, expanded: [] })),
  toggleTag: (tag: string): void => store.set((s) => ({ ...s, tags: [...toggleInSet(new Set(s.tags), tag)] })),
};

export const useBrowser = <S>(selector: (s: BrowserState) => S): S => useStore(store, selector);
