import { MODES, MODE_LABELS, MODE_SUMMARIES } from '@pro-studio/shared';
import { Segmented } from './components/Segmented';
import { KeysPanel } from './features/keys/KeysPanel';
import { preferences } from './state/preferences';
import { usePreferences } from './state/usePreferences';

/** Working title. Rename here and in index.html. */
const APP_NAME = 'Pro Studio';

export function App() {
  const prefs = usePreferences();
  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">{APP_NAME}</span>
        <Segmented
          label="Experience mode"
          value={prefs.mode}
          options={MODES.map((m) => ({ value: m, label: MODE_LABELS[m], hint: MODE_SUMMARIES[m] }))}
          onChange={(mode) => preferences.set({ mode })}
        />
        <span className="topbar-spacer" />
        <Segmented
          label="Theme"
          value={prefs.theme}
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
          ]}
          onChange={(theme) => preferences.set({ theme })}
        />
        <Segmented
          label="Density"
          value={prefs.density}
          options={[
            { value: 'auto', label: 'Auto', hint: 'Follows the mode' },
            { value: 'compact', label: 'Compact' },
            { value: 'comfortable', label: 'Roomy' },
          ]}
          onChange={(density) => preferences.set({ density })}
        />
      </header>

      <main className="main">
        <h1 className="page-title">{MODE_LABELS[prefs.mode]} mode</h1>
        <p className="page-sub" aria-live="polite">
          {MODE_SUMMARIES[prefs.mode]}
        </p>
        <KeysPanel />
        <p className="t-hint phase-note">
          Early preview: the keyboard piano. The piano roll, sound browser and dockable workspace are the next milestone
          (see docs/ROADMAP.md).
        </p>
      </main>
    </div>
  );
}
