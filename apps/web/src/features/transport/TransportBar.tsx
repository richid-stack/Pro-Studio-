import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  LAYOUT_PRESETS,
  MODES,
  MODE_LABELS,
  MODE_SUMMARIES,
  NOTE_NAMES,
  SCALES,
  SCALE_LABELS,
  SOUND_LIBRARY,
  STEP_TICKS,
  speakDb,
  formatPosition,
  createStarterProject,
  isFeatureVisible,
  setBars,
  setKey,
  setMasterDb,
  setProjectName,
  setScale,
  setSwing,
  setBpm,
  MAX_BARS,
  type Genre,
  type LayoutPresetId,
  type PanelId,
  type ScaleId,
} from '@pro-studio/shared';
import { audioHost } from '../../audio/audioHost';
import { addSound } from '../browser/actions';
import { Icon } from '../../components/Icon';
import { Knob } from '../../components/Knob';
import { Meter } from '../../components/Meter';
import { MenuBar, type MenuItem } from '../../components/Menu';
import { NumberField } from '../../components/NumberField';
import { Segmented } from '../../components/Segmented';
import { openProjectFile, saveProjectFile } from '../../state/files';
import { preferences } from '../../state/preferences';
import { studio, useCanRedo, useCanUndo, useProject } from '../../state/studio';
import { transport, usePlaying } from '../../state/transport';
import { uiState, useLayout, useLayoutPreset, workspaceLayout } from '../../state/ui';
import { usePreferences } from '../../state/usePreferences';
import { exportDialog } from '../dialogs/ExportDialog';
import { isMac } from '../dialogs/HelpDialog';
import { runShortcut } from '../shortcuts/useGlobalShortcuts';

const GENRE_LABELS: ReadonlyArray<[Genre, string]> = [
  ['trap', 'trap'],
  ['drill', 'drill'],
  ['rnb', 'R&B'],
  ['afro', 'Afrobeat'],
];
const PANELS: readonly PanelId[] = ['browser', 'rack', 'roll', 'playlist', 'mixer'];
const PANEL_NAMES: Record<PanelId, string> = {
  browser: 'Browser',
  rack: 'Channel rack',
  roll: 'Piano roll',
  playlist: 'Playlist',
  mixer: 'Mixer',
};
const PANEL_ICONS = {
  browser: 'window-browser',
  rack: 'window-rack',
  roll: 'window-roll',
  playlist: 'window-playlist',
  mixer: 'window-mixer',
} as const;

/** The playhead position, written straight into the element so the readout never re-renders React. */
function PositionReadout() {
  const el = useRef<HTMLOutputElement>(null);
  useEffect(() => {
    const paint = (): void => {
      if (el.current) el.current.textContent = formatPosition(audioHost.getTransport().loopTick / STEP_TICKS);
    };
    paint();
    return audioHost.subscribeTelemetry(paint);
  }, []);
  return (
    <output ref={el} className="position" aria-label="Position in bars, beats and steps" aria-live="off">
      1.1.1
    </output>
  );
}

function AudioStatus() {
  const status = useSyncExternalStore(audioHost.subscribeStatus, audioHost.getStatus, audioHost.getStatus);
  const { mode } = usePreferences();
  const technical = isFeatureVisible('numeric-readouts', mode);
  const latency = technical && status === 'running' ? audioHost.getLatencyMs() : null;
  const text: Record<typeof status, string> = {
    idle: 'Sound starts when you play',
    starting: 'Starting sound…',
    running: latency !== null ? `Sound on, ${Math.round(latency)} ms` : 'Sound on',
    suspended: 'Sound paused by the browser',
    unsupported: 'This browser cannot play sound',
    failed: 'Sound could not start',
  };
  return (
    <span
      className="audio-status"
      data-status={status}
      title={status === 'failed' ? audioHost.getError() : undefined}
    >
      <span className="status-dot" aria-hidden="true" />
      <span className="audio-status-text">{text[status]}</span>
    </span>
  );
}

export function TransportBar({ isMobile }: { isMobile: boolean }) {
  const project = useProject();
  const playing = usePlaying();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const layout = useLayout();
  const preset = useLayoutPreset();
  const prefs = usePreferences();
  const mode = prefs.mode;
  const mac = isMac();
  const plain = isFeatureVisible('plain-language', mode);
  const show = (id: string): boolean => isFeatureVisible(id, mode);
  const previews = show('transport-previews');
  const mod = mac ? '⌘' : 'Ctrl+';
  const redoKeys = `${mod}${mac ? '⇧Z' : 'Shift+Z'}`;
  /** Alt+1 to Alt+5 are fixed to the panel's place in the full list, whatever the mode shows. */
  const panelKey = (p: PanelId): string => `${mac ? '⌥' : 'Alt+'}${PANELS.indexOf(p) + 1}`;
  // PREVIEW controls: they look and toggle but do nothing yet (docs/ROADMAP.md lists what wires them up).
  const [lit, setLit] = useState<Record<string, boolean>>({ pat: true });
  const preview = (id: string, label: string, only?: readonly string[]): void => {
    setLit((l) => {
      const next = { ...l };
      if (only) for (const o of only) next[o] = false;
      next[id] = only ? true : !l[id];
      return next;
    });
    uiState.announce(`${label} is a preview and does nothing yet.`);
  };
  const visiblePanels = PANELS.filter((p) => p !== 'playlist' || show('playlist'));

  const fileItems: MenuItem[] = [
    ...GENRE_LABELS.map(([g, label]): MenuItem => ({
      label: `New ${label} beat`,
      onSelect: () => {
        studio.replace(createStarterProject(g));
        uiState.selectChannel(null);
        uiState.announce(`Started a new ${label} beat. Undo brings your previous project back.`);
      },
    })),
    { separator: true },
    { label: 'Open project file…', shortcut: `${mod}O`, onSelect: openProjectFile },
    { label: 'Save project file', shortcut: `${mod}S`, onSelect: () => saveProjectFile() },
    { separator: true },
    { label: 'Export audio…', shortcut: `${mod}E`, onSelect: () => exportDialog.open() },
  ];

  const editItems: MenuItem[] = [
    { label: 'Undo', shortcut: `${mod}Z`, disabled: !canUndo, onSelect: () => runShortcut('undo', isMobile) },
    { label: 'Redo', shortcut: redoKeys, disabled: !canRedo, onSelect: () => runShortcut('redo', isMobile) },
  ];

  const drums = SOUND_LIBRARY.filter((s) => s.kind === 'drum');
  const instruments = SOUND_LIBRARY.filter((s) => s.kind === 'inst');
  const addItems: MenuItem[] = [
    ...drums.map((s): MenuItem => ({ label: s.label, onSelect: () => addSound(s) })),
    { separator: true },
    ...instruments.map((s): MenuItem => ({ label: s.label, onSelect: () => addSound(s) })),
  ];

  const viewItems: MenuItem[] = [
    ...visiblePanels.map((p): MenuItem => ({
      label: PANEL_NAMES[p],
      shortcut: panelKey(p),
      checked: isMobile ? uiState.get().mobilePanel === p : !layout.hidden.includes(p),
      onSelect: () => (isMobile ? uiState.setMobilePanel(p) : workspaceLayout.toggle(p)),
    })),
    ...(show('dock-layouts') && !isMobile
      ? ([
          { separator: true },
          ...(Object.keys(LAYOUT_PRESETS) as LayoutPresetId[]).map((id): MenuItem => ({
            label: `${LAYOUT_PRESETS[id].label} layout`,
            radio: true,
            checked: preset === id,
            onSelect: () => workspaceLayout.preset(id),
          })),
        ] as MenuItem[])
      : []),
  ];

  const optionItems: MenuItem[] = [
    ...(isMobile
      ? ([
          ...MODES.map((m): MenuItem => ({
            label: `${MODE_LABELS[m]} mode`,
            radio: true,
            checked: mode === m,
            onSelect: () => preferences.set({ mode: m }),
          })),
          { separator: true },
        ] as MenuItem[])
      : []),
    {
      label: 'Dark theme',
      radio: true,
      checked: prefs.theme === 'dark',
      onSelect: () => preferences.set({ theme: 'dark' }),
    },
    {
      label: 'Light theme',
      radio: true,
      checked: prefs.theme === 'light',
      onSelect: () => preferences.set({ theme: 'light' }),
    },
    { separator: true },
    {
      label: 'Density follows the mode',
      radio: true,
      checked: prefs.density === 'auto',
      onSelect: () => preferences.set({ density: 'auto' }),
    },
    {
      label: 'Compact',
      radio: true,
      checked: prefs.density === 'compact',
      onSelect: () => preferences.set({ density: 'compact' }),
    },
    {
      label: 'Comfortable',
      radio: true,
      checked: prefs.density === 'comfortable',
      onSelect: () => preferences.set({ density: 'comfortable' }),
    },
  ];

  const helpItems: MenuItem[] = [
    { label: 'Keyboard shortcuts', shortcut: '?', onSelect: () => uiState.setHelp(true) },
  ];

  const darkTheme = prefs.theme === 'dark';

  return (
    <header className="topbar">
      <div className="tb-row">
        <div className="tb-menus">
          <span className="brand">Pro Studio</span>
          <MenuBar
            label="Main menu"
            menus={[
              { label: 'File', items: fileItems },
              { label: 'Edit', items: editItems },
              { label: 'Add', items: addItems },
              { label: 'View', items: viewItems },
              { label: 'Options', items: optionItems },
              { label: 'Help', items: helpItems },
            ]}
          />
        </div>

        <div className="tb-group" role="toolbar" aria-label="Transport">
          <div className="tb-pill">
            {previews && (
              <div className="tb-mode" role="group" aria-label="Playback mode (preview)">
                {/* PREVIEW: pattern and song playback are not separate yet */}
                <button
                  type="button"
                  data-preview="true"
                  data-lit={lit.pat ? 'pat' : undefined}
                  aria-pressed={!!lit.pat}
                  title="Pattern mode (preview: does nothing yet)"
                  onClick={() => preview('pat', 'Pattern mode', ['song'])}
                >
                  PAT
                </button>
                <button
                  type="button"
                  data-preview="true"
                  data-lit={lit.song ? 'song' : undefined}
                  aria-pressed={!!lit.song}
                  title="Song mode (preview: does nothing yet)"
                  onClick={() => preview('song', 'Song mode', ['pat'])}
                >
                  SONG
                </button>
              </div>
            )}
            <button
              type="button"
              className="tb-play"
              data-kind="play"
              aria-pressed={playing}
              aria-label={playing ? 'Pause' : 'Play'}
              title={`${playing ? 'Pause' : 'Play'} (Space)`}
              onClick={() => transport.toggle()}
            >
              <Icon name={playing ? 'pause' : 'play'} />
            </button>
            <button
              type="button"
              className="tb-stop"
              aria-label="Stop"
              title="Stop and return to the start (Shift+Space)"
              onClick={() => transport.stop()}
            >
              <Icon name="stop" />
            </button>
          </div>
          {/* PREVIEW: recording is not built yet */}
          {previews && (
            <button
              type="button"
              className="tb-record"
              data-preview="true"
              aria-pressed={!!lit.record}
              aria-label="Record (preview)"
              title="Record (preview: does nothing yet)"
              onClick={() => preview('record', 'Record')}
            >
              <span aria-hidden="true" />
            </button>
          )}
          <label className="lcd lcd-tempo">
            <NumberField
              className="lcd-input"
              label="Tempo in beats per minute"
              value={project.bpm}
              min={40}
              max={240}
              step={1}
              decimals={2}
              fixed
              onCommit={(v) => studio.edit((p) => setBpm(p, v), { key: 'bpm' })}
            />
            <span className="lcd-cap" aria-hidden="true">
              {plain ? 'Speed' : 'BPM'}
            </span>
          </label>
        </div>

        <div className="tb-group" role="group" aria-label="History and click">
          <button
            type="button"
            className="tb-btn"
            aria-label="Undo"
            title={`Undo (${mod}Z)`}
            disabled={!canUndo}
            onClick={() => runShortcut('undo', isMobile)}
          >
            <Icon name="undo" />
          </button>
          <button
            type="button"
            className="tb-btn"
            aria-label="Redo"
            title={`Redo (${redoKeys})`}
            disabled={!canRedo}
            onClick={() => runShortcut('redo', isMobile)}
          >
            <Icon name="redo" />
          </button>
          {/* PREVIEW: the engine has no click track or loop region yet */}
          {previews && (
            <>
              <button
                type="button"
                className="tb-btn tb-preview"
                data-preview="true"
                aria-pressed={!!lit.metronome}
                aria-label="Metronome (preview)"
                title="Metronome (preview: does nothing yet)"
                onClick={() => preview('metronome', 'Metronome')}
              >
                <Icon name="metronome" />
              </button>
              <button
                type="button"
                className="tb-btn tb-preview"
                data-preview="true"
                aria-pressed={!!lit.loop}
                aria-label="Loop (preview)"
                title="Loop (preview: does nothing yet)"
                onClick={() => preview('loop', 'Loop')}
              >
                <Icon name="loop" />
              </button>
            </>
          )}
        </div>

        <div className="lcd lcd-time">
          <PositionReadout />
          <span className="lcd-cap" aria-hidden="true">
            {plain ? 'Bar · beat · step' : 'B.B.S'}
          </span>
        </div>

        <div className="tb-scope" role="group" aria-label="Master level">
          <Meter horizontal source={{ master: 'L' }} label="Master level, left" />
          <Meter horizontal source={{ master: 'R' }} label="Master level, right" />
        </div>

        <div className="tb-group tb-files" role="group" aria-label="Project file">
          <button
            type="button"
            className="tb-btn"
            aria-label="Save project file"
            title={`Save project file (${mod}S)`}
            onClick={() => saveProjectFile()}
          >
            <Icon name="save" />
          </button>
          <button
            type="button"
            className="tb-btn"
            aria-label="Open project file"
            title={`Open project file (${mod}O)`}
            onClick={openProjectFile}
          >
            <Icon name="folder-open" />
          </button>
          <button
            type="button"
            className="tb-btn"
            aria-label="Export audio"
            title={`Export audio (${mod}E)`}
            onClick={() => exportDialog.open()}
          >
            <Icon name="export" />
          </button>
          <button
            type="button"
            className="tb-btn"
            aria-label="Help and keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            onClick={() => uiState.setHelp(true)}
          >
            <Icon name="help" />
          </button>
        </div>
      </div>

      <div className="tb-row tb-row-2">
        <input
          className="tb-field project-name"
          aria-label="Project name"
          defaultValue={project.name}
          key={project.name}
          maxLength={80}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => studio.edit((p) => setProjectName(p, e.currentTarget.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              e.currentTarget.value = project.name;
              e.currentTarget.blur();
            }
          }}
        />

        <div className="tb-group tb-knobs">
          <div className="tb-knob">
            <Knob
              label="Master volume"
              value={project.masterDb}
              min={-24}
              max={6}
              step={0.5}
              defaultValue={0}
              format={speakDb}
              onChange={(v) => studio.edit((p) => setMasterDb(p, v), { key: 'master' })}
            />
            <span className="field-label" aria-hidden="true">
              Master
            </span>
          </div>
          <div className="tb-knob">
            <Knob
              label="Swing"
              value={project.swing}
              min={0}
              max={1}
              step={0.01}
              defaultValue={0}
              format={(v) => `${Math.round(v * 100)} percent`}
              onChange={(v) => studio.edit((p) => setSwing(p, v), { key: 'swing' })}
            />
            <span className="field-label" aria-hidden="true">
              Swing
            </span>
            <span className="readout-sm">{Math.round(project.swing * 100)}%</span>
          </div>
        </div>

        <div className="tb-group tb-tonal">
          <label className="tb-select">
            <span className="field-label">Bars</span>
            <select
              className="select"
              aria-label="Pattern length in bars"
              value={project.bars}
              onChange={(e) => studio.edit((p) => setBars(p, Number(e.target.value)))}
            >
              {Array.from({ length: MAX_BARS }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="tb-select">
            <span className="field-label">Key</span>
            <select
              className="select"
              aria-label="Key"
              value={project.key}
              onChange={(e) => studio.edit((p) => setKey(p, Number(e.target.value)))}
            >
              {NOTE_NAMES.map((n, i) => (
                <option key={n} value={i}>
                  {n}
                </option>
              ))}
            </select>
            <select
              className="select select-wide"
              aria-label="Scale"
              value={project.scale}
              onChange={(e) => studio.edit((p) => setScale(p, e.target.value as ScaleId))}
            >
              {(Object.keys(SCALES) as ScaleId[]).map((s) => (
                <option key={s} value={s}>
                  {SCALE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* PREVIEW: patterns are not in the project model yet; the selector shows the one pattern there is */}
        {previews && (
          <div className="tb-pattern" role="group" aria-label="Pattern (preview)">
            <button
              type="button"
              data-preview="true"
              aria-label="Previous pattern (preview)"
              title="Previous pattern (preview: does nothing yet)"
              onClick={() => preview('pattern-prev', 'The pattern selector')}
            >
              <Icon name="chevron" size="sm" />
            </button>
            <span className="tb-pattern-name">Pattern 1</span>
            <button
              type="button"
              data-preview="true"
              aria-label="Add a pattern (preview)"
              title="Add a pattern (preview: does nothing yet)"
              onClick={() => preview('pattern-add', 'Add pattern')}
            >
              <Icon name="plus" size="sm" />
            </button>
          </div>
        )}

        <div className="tb-group tb-windows" role="group" aria-label="Show or hide a panel">
          {visiblePanels.map((p) => {
            const open = !layout.hidden.includes(p);
            return (
              <button
                key={p}
                type="button"
                className="tb-btn"
                aria-pressed={open}
                aria-label={PANEL_NAMES[p]}
                title={`${open ? 'Hide' : 'Show'} ${PANEL_NAMES[p]} (${panelKey(p)})`}
                onClick={() => workspaceLayout.toggle(p)}
              >
                <Icon name={PANEL_ICONS[p]} />
              </button>
            );
          })}
        </div>

        <div className="tb-end">
          <div className="tb-panel tb-status">
            <AudioStatus />
          </div>
          <Segmented
            label="Experience mode"
            value={mode}
            options={MODES.map((m) => ({ value: m, label: MODE_LABELS[m], hint: MODE_SUMMARIES[m] }))}
            onChange={(m) => preferences.set({ mode: m })}
          />
          <button
            type="button"
            className="tb-btn"
            aria-label={darkTheme ? 'Switch to the light theme' : 'Switch to the dark theme'}
            title={darkTheme ? 'Switch to the light theme' : 'Switch to the dark theme'}
            onClick={() => preferences.set({ theme: darkTheme ? 'light' : 'dark' })}
          >
            <Icon name={darkTheme ? 'sun' : 'moon'} />
          </button>
        </div>
      </div>
    </header>
  );
}
