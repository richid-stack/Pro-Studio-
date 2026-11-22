import { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  LAYOUT_PRESETS, MODES, MODE_LABELS, MODE_SUMMARIES, NOTE_NAMES, SCALES, SCALE_LABELS, STEP_TICKS, speakDb,
  formatPosition, createStarterProject, isFeatureVisible, setBars, setKey, setMasterDb, setProjectName, setScale, setSwing, setBpm, MAX_BARS,
  type Genre, type LayoutPresetId, type PanelId, type ScaleId,
} from '@pro-studio/shared';
import { audioHost } from '../../audio/audioHost';
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

const GENRE_LABELS: ReadonlyArray<[Genre, string]> = [['trap', 'trap'], ['drill', 'drill'], ['rnb', 'R&B'], ['afro', 'Afrobeat']];
const PANELS: readonly PanelId[] = ['browser', 'rack', 'roll', 'playlist', 'mixer'];
const PANEL_NAMES: Record<PanelId, string> = { browser: 'Browser', rack: 'Channel rack', roll: 'Piano roll', playlist: 'Playlist', mixer: 'Mixer' };

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
    <span className="audio-status" data-status={status} title={status === 'failed' ? audioHost.getError() : undefined}>
      <span className="status-dot" aria-hidden="true" />
      {text[status]}
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
  const mod = mac ? '⌘' : 'Ctrl+';

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
    { label: 'Redo', shortcut: `${mod}${mac ? '⇧Z' : 'Shift+Z'}`, disabled: !canRedo, onSelect: () => runShortcut('redo', isMobile) },
  ];

  const viewItems: MenuItem[] = [
    ...PANELS.filter((p) => p !== 'playlist' || show('playlist')).map((p, i): MenuItem => ({
      label: PANEL_NAMES[p],
      shortcut: `${mac ? '⌥' : 'Alt+'}${i + 1}`,
      checked: isMobile ? uiState.get().mobilePanel === p : !layout.hidden.includes(p),
      onSelect: () => (isMobile ? uiState.setMobilePanel(p) : workspaceLayout.toggle(p)),
    })),
    ...(show('dock-layouts') && !isMobile
      ? ([
          { separator: true },
          ...(Object.keys(LAYOUT_PRESETS) as LayoutPresetId[]).map((id): MenuItem => ({ label: `${LAYOUT_PRESETS[id].label} layout`, radio: true, checked: preset === id, onSelect: () => workspaceLayout.preset(id) })),
        ] as MenuItem[])
      : []),
    ...(isMobile
      ? ([
          { separator: true },
          ...MODES.map((m): MenuItem => ({ label: `${MODE_LABELS[m]} mode`, radio: true, checked: mode === m, onSelect: () => preferences.set({ mode: m }) })),
        ] as MenuItem[])
      : []),
    { separator: true },
    { label: 'Dark theme', radio: true, checked: prefs.theme === 'dark', onSelect: () => preferences.set({ theme: 'dark' }) },
    { label: 'Light theme', radio: true, checked: prefs.theme === 'light', onSelect: () => preferences.set({ theme: 'light' }) },
    { separator: true },
    { label: 'Density follows the mode', radio: true, checked: prefs.density === 'auto', onSelect: () => preferences.set({ density: 'auto' }) },
    { label: 'Compact', radio: true, checked: prefs.density === 'compact', onSelect: () => preferences.set({ density: 'compact' }) },
    { label: 'Comfortable', radio: true, checked: prefs.density === 'comfortable', onSelect: () => preferences.set({ density: 'comfortable' }) },
  ];

  const helpItems: MenuItem[] = [{ label: 'Keyboard shortcuts', shortcut: '?', onSelect: () => uiState.setHelp(true) }];

  const darkTheme = prefs.theme === 'dark';

  return (
    <header className="topbar">
      <div className="menurow">
        <span className="brand">Pro Studio</span>
        <MenuBar
          label="Main menu"
          menus={[
            { label: 'File', items: fileItems },
            { label: 'Edit', items: editItems },
            { label: 'View', items: viewItems },
            { label: 'Help', items: helpItems },
          ]}
        />
        <input
          className="project-name"
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
        <div className="menurow-end">
          <Segmented label="Experience mode" value={mode} options={MODES.map((m) => ({ value: m, label: MODE_LABELS[m], hint: MODE_SUMMARIES[m] }))} onChange={(m) => preferences.set({ mode: m })} />
          <button
            type="button"
            className="icon-btn"
            aria-label={darkTheme ? 'Switch to the light theme' : 'Switch to the dark theme'}
            title={darkTheme ? 'Switch to the light theme' : 'Switch to the dark theme'}
            onClick={() => preferences.set({ theme: darkTheme ? 'light' : 'dark' })}
          >
            <Icon name={darkTheme ? 'sun' : 'moon'} />
          </button>
        </div>
      </div>

      <div className="transport" role="toolbar" aria-label="Transport">
        <div className="transport-group">
          <button type="button" className="icon-btn icon-btn-lg" data-kind="play" aria-pressed={playing} aria-label={playing ? 'Pause' : 'Play'} title={`${playing ? 'Pause' : 'Play'} (Space)`} onClick={() => transport.toggle()}>
            <Icon name={playing ? 'pause' : 'play'} />
          </button>
          <button type="button" className="icon-btn icon-btn-lg" aria-label="Stop" title="Stop and return to the start (Shift+Space)" onClick={() => transport.stop()}>
            <Icon name="stop" />
          </button>
          <PositionReadout />
        </div>

        <label className="transport-field">
          <span className="field-label">{plain ? 'Speed (BPM)' : 'Tempo'}</span>
          <NumberField label="Tempo in beats per minute" value={project.bpm} min={40} max={240} step={1} decimals={2} onCommit={(v) => studio.edit((p) => setBpm(p, v), { key: 'bpm' })} />
        </label>

        <div className="transport-field">
          <span className="field-label" id="swing-label">Swing</span>
          <div className="field-inline">
            <Knob label="Swing" value={project.swing} min={0} max={1} step={0.01} defaultValue={0} format={(v) => `${Math.round(v * 100)} percent`} onChange={(v) => studio.edit((p) => setSwing(p, v), { key: 'swing' })} />
            <span className="readout-sm">{Math.round(project.swing * 100)}%</span>
          </div>
        </div>

        <label className="transport-field">
          <span className="field-label">Bars</span>
          <select className="select" aria-label="Pattern length in bars" value={project.bars} onChange={(e) => studio.edit((p) => setBars(p, Number(e.target.value)))}>
            {Array.from({ length: MAX_BARS }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>

        <div className="transport-field">
          <span className="field-label">Key</span>
          <div className="field-inline">
            <select className="select" aria-label="Key" value={project.key} onChange={(e) => studio.edit((p) => setKey(p, Number(e.target.value)))}>
              {NOTE_NAMES.map((n, i) => (
                <option key={n} value={i}>{n}</option>
              ))}
            </select>
            <select className="select select-wide" aria-label="Scale" value={project.scale} onChange={(e) => studio.edit((p) => setScale(p, e.target.value as ScaleId))}>
              {(Object.keys(SCALES) as ScaleId[]).map((s) => (
                <option key={s} value={s}>{SCALE_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="transport-field">
          <span className="field-label">Master</span>
          <div className="field-inline">
            <Knob label="Master volume" value={project.masterDb} min={-24} max={6} step={0.5} defaultValue={0} format={speakDb} onChange={(v) => studio.edit((p) => setMasterDb(p, v), { key: 'master' })} />
            <span className="master-meters">
              <Meter source={{ master: 'L' }} label="Master level, left" />
              <Meter source={{ master: 'R' }} label="Master level, right" />
            </span>
          </div>
        </div>

        <div className="transport-group transport-end">
          <button type="button" className="icon-btn" aria-label="Undo" title={`Undo (${mod}Z)`} disabled={!canUndo} onClick={() => runShortcut('undo', isMobile)}>
            <Icon name="undo" />
          </button>
          <button type="button" className="icon-btn" aria-label="Redo" title={`Redo (${mod}${mac ? '⇧Z' : 'Shift+Z'})`} disabled={!canRedo} onClick={() => runShortcut('redo', isMobile)}>
            <Icon name="redo" />
          </button>
          <AudioStatus />
        </div>
      </div>
    </header>
  );
}

