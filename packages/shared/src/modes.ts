/**
 * Experience modes. One engine, one project format, three levels of interface.
 *
 *   beginner  guided, lots of help, safety rails on, plain language, comfortable density
 *   standard  the full workspace for everyone, assists available on demand
 *   pro       every technical control, routing, per-note properties, analysis, dense layout
 *
 * Rules (enforced by tests where they can be):
 *  - A mode only changes what is SHOWN and the DEFAULTS. It never changes the project data, so switching
 *    is instant, lossless and reversible. Something made in Pro is shown as a summary in lower modes
 *    ("this note has pan automation - open in Pro to edit"), never dropped or flattened.
 *  - Reveal features appear from a mode upward (`from`). Guidance features appear up to a mode (`until`),
 *    so a Pro user is not nagged by coach marks. Anyone can override guidance on or off in settings.
 *  - Every feature has an id here, so the UI asks `isFeatureVisible(id, mode)` instead of scattering
 *    `if (mode === ...)` checks.
 */

export type Mode = 'beginner' | 'standard' | 'pro';

export const MODES: readonly Mode[] = ['beginner', 'standard', 'pro'];

export const MODE_LABELS: Readonly<Record<Mode, string>> = {
  beginner: 'Beginner',
  standard: 'Standard',
  pro: 'Pro',
};

/** One-line promise shown in the mode switcher. */
export const MODE_SUMMARIES: Readonly<Record<Mode, string>> = {
  beginner: 'Step-by-step help. Starts a beat for you and explains every choice.',
  standard: 'The full studio, uncluttered. Assist tools when you want them.',
  pro: 'Every parameter, routing and analysis tool. Dense layout.',
};

const RANK: Readonly<Record<Mode, number>> = { beginner: 0, standard: 1, pro: 2 };

export function isMode(value: unknown): value is Mode {
  return typeof value === 'string' && (MODES as readonly string[]).includes(value);
}

/** True when `mode` is at or above `min`. */
export function atLeast(mode: Mode, min: Mode): boolean {
  return RANK[mode] >= RANK[min];
}

export type FeatureKind = 'tool' | 'guidance';

export interface FeatureDef {
  id: string;
  label: string;
  kind: FeatureKind;
  /** Visible from this mode upward. Omit for "all modes". */
  from?: Mode;
  /** Visible up to this mode. Omit for "all modes". */
  until?: Mode;
}

/**
 * The registry. Add the feature here in the same change that adds its UI.
 * Roadmap items that are not built yet are listed in docs/ROADMAP.md, not here.
 */
export const FEATURES: readonly FeatureDef[] = [
  // Guidance: help that fades as the user gains skill.
  { id: 'coach-marks', label: 'Coach marks and first-run tour', kind: 'guidance', until: 'beginner' },
  { id: 'plain-language', label: 'Plain-language labels and hints', kind: 'guidance', until: 'beginner' },
  { id: 'guided-builder', label: 'Guided beat builder', kind: 'guidance', until: 'beginner' },
  { id: 'explain-suggestions', label: 'Explain why for every suggestion', kind: 'guidance', until: 'standard' },
  { id: 'safety-rails', label: 'Safety rails (key lock, loudness guard)', kind: 'guidance', until: 'standard' },

  // Tools available from the start.
  { id: 'keyboard-piano', label: 'Laptop-keyboard piano', kind: 'tool' },
  { id: 'sound-browser', label: 'Sound browser', kind: 'tool' },
  { id: 'vibe-starter', label: 'Vibe Starter', kind: 'tool' },
  { id: 'mix-health-check', label: 'Mix health check', kind: 'tool' },

  // The core workshop is open to everyone: a beginner who cannot see the step grid cannot make a beat.
  // Beginner differs by guidance and by what each panel shows, not by hiding the panels.
  { id: 'channel-rack', label: 'Channel rack', kind: 'tool' },
  { id: 'piano-roll', label: 'Piano roll', kind: 'tool' },
  { id: 'mixer', label: 'Mixer', kind: 'tool' },
  { id: 'project-files', label: 'New, open, save and starter beats', kind: 'tool' },
  { id: 'export-wav', label: 'Export to WAV', kind: 'tool' },
  { id: 'roll-scale-rows', label: 'Key and scale shown in the piano roll', kind: 'tool' },

  // Standard: the full workspace.
  { id: 'playlist', label: 'Playlist', kind: 'tool', from: 'standard' },
  { id: 'step-editor', label: 'Per-step velocity, ratchet and roll shape', kind: 'tool', from: 'standard' },
  { id: 'velocity-lane', label: 'Velocity lane under the piano roll', kind: 'tool', from: 'standard' },
  { id: 'mixer-sends', label: 'Reverb, delay and duck sends on the mixer', kind: 'tool', from: 'standard' },
  { id: 'chord-brain', label: 'Chord brain', kind: 'tool', from: 'standard' },
  { id: 'hihat-designer', label: 'Hi-hat designer', kind: 'tool', from: 'standard' },
  { id: 'dock-layouts', label: 'Dockable, maximizable panels', kind: 'tool', from: 'standard' },

  // Pro: the technical depth.
  { id: 'per-note-properties', label: 'Per-note pan, cutoff, release and slide', kind: 'tool', from: 'pro' },
  { id: 'mixer-routing', label: 'Arbitrary mixer routing and sidechain matrix', kind: 'tool', from: 'pro' },
  { id: 'automation-editor', label: 'Automation editor with curves', kind: 'tool', from: 'pro' },
  { id: 'tempo-map', label: 'Tempo and time-signature map', kind: 'tool', from: 'pro' },
  { id: 'analysis-panels', label: 'Spectrum, phase and loudness analysis', kind: 'tool', from: 'pro' },
  { id: 'midi-cc-editor', label: 'MIDI CC and pitch-bend editor', kind: 'tool', from: 'pro' },
  { id: 'shortcut-editor', label: 'Custom shortcuts and macros', kind: 'tool', from: 'pro' },
  { id: 'numeric-readouts', label: 'Numeric readouts (MIDI numbers, Hz, ms)', kind: 'tool', from: 'pro' },
];

export interface ModeOverrides {
  /** Force guidance features on or off regardless of mode. Undefined = follow the mode. */
  guidance?: boolean;
}

export function isFeatureVisible(id: string, mode: Mode, overrides: ModeOverrides = {}): boolean {
  const f = FEATURES.find((x) => x.id === id);
  if (!f) return false;
  if (f.kind === 'guidance' && overrides.guidance !== undefined) return overrides.guidance;
  if (f.from && !atLeast(mode, f.from)) return false;
  if (f.until && !atLeast(f.until, mode)) return false;
  return true;
}

export function visibleFeatures(mode: Mode, overrides: ModeOverrides = {}): FeatureDef[] {
  return FEATURES.filter((f) => isFeatureVisible(f.id, mode, overrides));
}

export interface ModeDefaults {
  density: 'compact' | 'comfortable';
  /** Notes snap to the project scale while drawing and playing. */
  scaleSnap: boolean;
  /** Keep the master below clipping and warn before export. */
  loudnessGuard: boolean;
  /** Ask before destructive actions (clear channel, delete section). */
  confirmDestructive: boolean;
}

export const MODE_DEFAULTS: Readonly<Record<Mode, ModeDefaults>> = {
  beginner: { density: 'comfortable', scaleSnap: true, loudnessGuard: true, confirmDestructive: true },
  standard: { density: 'compact', scaleSnap: false, loudnessGuard: true, confirmDestructive: true },
  pro: { density: 'compact', scaleSnap: false, loudnessGuard: false, confirmDestructive: false },
};
