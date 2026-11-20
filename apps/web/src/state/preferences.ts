/**
 * User preferences: experience mode, theme and density. Local-first (localStorage, guarded because it can
 * throw or come back empty in private windows); an account will sync them later.
 * The mode is a preference, not project data: see docs/ARCHITECTURE.md section 5b.
 */
import { MODE_DEFAULTS, isMode, type Mode } from '@forge/shared';
import { applyDensity, applyTheme, type Density, type Theme } from '@forge/ui';

export interface Preferences {
  mode: Mode;
  theme: Theme;
  /** 'auto' follows the mode's default density. */
  density: Density | 'auto';
}

const STORAGE_KEY = 'forge.preferences.v1';
const DEFAULTS: Preferences = { mode: 'standard', theme: 'dark', density: 'auto' };

function load(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const o = JSON.parse(raw) as Partial<Record<keyof Preferences, unknown>>;
    return {
      mode: isMode(o.mode) ? o.mode : DEFAULTS.mode,
      theme: o.theme === 'light' ? 'light' : 'dark',
      density: o.density === 'compact' || o.density === 'comfortable' ? o.density : 'auto',
    };
  } catch {
    return DEFAULTS;
  }
}

export function effectiveDensity(p: Preferences): Density {
  return p.density === 'auto' ? MODE_DEFAULTS[p.mode].density : p.density;
}

let state: Preferences = load();
const listeners = new Set<() => void>();

function apply(p: Preferences): void {
  applyTheme(p.theme);
  applyDensity(effectiveDensity(p));
}

apply(state);

export const preferences = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get(): Preferences {
    return state;
  },
  set(patch: Partial<Preferences>): void {
    state = { ...state, ...patch };
    apply(state);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable: the preference lasts for this page load only.
    }
    for (const l of listeners) l();
  },
};
