import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  DEFAULT_FLOAT,
  PANELS,
  MAX_BROWSER_W,
  MIN_BROWSER_W,
  MIN_MIXER_H,
  MIN_RACK_W,
  MIN_ROLL_H,
  MIN_TOP_H,
  MIN_PLAYLIST_W,
  PANEL_LABELS,
  SPLITTER,
  clampRect,
  fitFloating,
  fitLayout,
  isFeatureVisible,
  visibleFloating,
  MIN_FLOAT,
  type Bounds,
  type PanelId,
  type WindowRect,
  type WorkspaceLayout,
} from '@pro-studio/shared';
import { FloatingWindow } from '../../components/FloatingWindow';
import { PanelFrame } from '../../components/PanelFrame';
import { handOverDrag } from '../../components/windowDrag';
import { Splitter } from '../../components/Splitter';
import { uiState, useLayout, useUi, workspaceLayout } from '../../state/ui';
import { usePreferences } from '../../state/usePreferences';
import { Browser } from '../browser/Browser';
import { KeysDock } from '../keys/KeysDock';
import { Mixer } from '../mixer/Mixer';
import { Playlist } from '../playlist/Playlist';
import { ChannelRack } from '../rack/ChannelRack';
import { PianoRoll } from '../roll/PianoRoll';

const MOBILE_TABS: ReadonlyArray<[PanelId | 'keys', string]> = [
  ['browser', 'Browser'],
  ['rack', 'Rack'],
  ['roll', 'Roll'],
  ['playlist', 'Playlist'],
  ['mixer', 'Mixer'],
  ['keys', 'Keys'],
];

export function Workspace({ isMobile }: { isMobile: boolean }) {
  const layout = useLayout();
  const mobilePanel = useUi((s) => s.mobilePanel);
  const { mode } = usePreferences();
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1280, height: 720 });
  const canDock = isFeatureVisible('dock-layouts', mode) && !isMobile;
  const canFloat = isFeatureVisible('floating-windows', mode) && !isMobile;
  const playlistOk = isFeatureVisible('playlist', mode);
  const [bounds, setBounds] = useState<Bounds>({ width: 1280, height: 720 });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((s) => (Math.abs(s.width - width) < 0.5 && Math.abs(s.height - height) < 0.5 ? s : { width, height }));
      // windows are placed against the whole box, padding included
      const b = { width: el.clientWidth, height: el.clientHeight };
      workspaceLayout.setBounds(b);
      setBounds((old) => (old.width === b.width && old.height === b.height ? old : b));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // the playlist belongs to Standard and up, whatever the saved layout says
  const hidden: readonly PanelId[] = playlistOk ? layout.hidden : [...new Set<PanelId>([...layout.hidden, 'playlist'])];
  const maximized = canDock ? layout.maximized : null;
  // windows float above the dock and take no room in it; they step aside while a panel is maximized
  const floatIds: PanelId[] = canFloat && !maximized ? visibleFloating({ ...layout, hidden }) : [];
  const docked: readonly PanelId[] = [...hidden, ...floatIds];
  const fitted: WorkspaceLayout = fitLayout({ ...layout, hidden: docked }, { width: size.width, height: size.height, barH: 0 });
  const windowRects = fitFloating(layout, bounds).floating;

  // the roll's tools live in its header, as in other DAWs; the roll renders into this slot (see PianoRoll's toolsHost)
  // each panel's tools live in its title bar, as in other DAWs; a panel renders its toolbar into its slot (its `toolsHost`)
  const [toolHosts, setToolHosts] = useState<Partial<Record<PanelId, HTMLElement | null>>>({});
  const slotRef = useMemo(() => Object.fromEntries(PANELS.map((id) => [id, (el: HTMLElement | null) => setToolHosts((h) => (h[id] === el ? h : { ...h, [id]: el }))])) as Record<PanelId, (el: HTMLElement | null) => void>, []);
  const toolSlot = (id: PanelId): ReactNode => <div className="panel-tools-slot" ref={slotRef[id]} />;

  /**
   * The rect a docked panel takes when it becomes a window: the panel's usual window size, placed just below and right
   * of where it was, or with the pointer on its title bar when it was dragged out.
   */
  const windowRectFor = (id: PanelId, pointer?: { clientX: number; clientY: number }): WindowRect => {
    const box_ = box.current;
    const el = box_?.querySelector<HTMLElement>(`.workspace [data-panel="${id}"]`);
    const d = DEFAULT_FLOAT[id];
    if (!box_ || !el) return clampRect({ x: 24, y: 16, ...d }, MIN_FLOAT[id], bounds);
    const bb = box_.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const w = Math.max(MIN_FLOAT[id].w, Math.min(d.w, Math.round(bounds.width * 0.9)));
    const h = Math.max(MIN_FLOAT[id].h, Math.min(d.h, Math.round(bounds.height * 0.9)));
    const x = pointer ? pointer.clientX - bb.left - w * 0.3 : r.left - bb.left + 24;
    const y = pointer ? pointer.clientY - bb.top - 14 : r.top - bb.top + 24;
    // keep a pop-out fully inside the box; a dragged-out window follows the pointer wherever it is
    return pointer
      ? { x, y, w, h }
      : {
          x: Math.max(0, Math.min(x, bounds.width - w)),
          y: Math.max(0, Math.min(y, bounds.height - h)),
          w,
          h,
        };
  };
  const popOut = (id: PanelId): void => {
    workspaceLayout.float(id, windowRectFor(id));
    uiState.announce(`${PANEL_LABELS[id]} is now a floating window.`);
  };
  const detach = (id: PanelId, pointer: { clientX: number; clientY: number }): void => {
    handOverDrag({ id, ...pointer });
    workspaceLayout.float(id, windowRectFor(id, pointer));
  };

  const frame = (id: PanelId, body: ReactNode, badge?: string): ReactNode => (
    <PanelFrame
      id={id}
      maximized={maximized === id}
      canMaximize={canDock}
      onToggleMaximize={() => workspaceLayout.maximize(maximized === id ? null : id)}
      badge={badge}
      tools={isMobile ? undefined : toolSlot(id)}
      onFloat={canFloat && !maximized ? () => popOut(id) : undefined}
      onDetach={canFloat && !maximized ? (pointer) => detach(id, pointer) : undefined}
    >
      {body}
    </PanelFrame>
  );

  const host = (id: PanelId): HTMLElement | null => (isMobile ? null : (toolHosts[id] ?? null));
  const bodies: Record<PanelId, ReactNode> = {
    browser: <Browser toolsHost={host('browser')} />,
    rack: <ChannelRack isMobile={isMobile} toolsHost={host('rack')} />,
    roll: <PianoRoll isMobile={isMobile} toolsHost={host('roll')} />,
    playlist: <Playlist toolsHost={host('playlist')} />,
    mixer: <Mixer toolsHost={host('mixer')} />,
  };
  const badges: Partial<Record<PanelId, string>> = { playlist: 'Preview' };

  let content: ReactNode;
  if (isMobile) {
    const showPlaylist = playlistOk;
    const tabs = MOBILE_TABS.filter(([id]) => id !== 'playlist' || showPlaylist);
    const current = tabs.some(([id]) => id === mobilePanel) ? mobilePanel : 'rack';
    content = (
      <div className="workspace workspace-mobile">
        <div className="mobile-panel">
          {current === 'keys' ? (
            <section className="panel" data-panel="keys" aria-label="Keys">
              <header className="panel-header">
                <h2 className="panel-title">Keys</h2>
              </header>
              <div className="panel-body">
                <KeysDock />
              </div>
            </section>
          ) : (
            frame(current, bodies[current], badges[current])
          )}
        </div>
        <nav className="mobile-nav" aria-label="Panels">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" className="mobile-tab" aria-current={current === id ? 'page' : undefined} onClick={() => uiState.setMobilePanel(id)}>
              {label}
            </button>
          ))}
        </nav>
      </div>
    );
  } else if (maximized) {
    content = <div className="workspace workspace-single">{frame(maximized, bodies[maximized], badges[maximized])}</div>;
  } else {
    const isHidden = (id: PanelId): boolean => fitted.hidden.includes(id);
    const showBrowser = !isHidden('browser');
    const showRack = !isHidden('rack');
    const showPlaylist = !isHidden('playlist');
    const showRoll = !isHidden('roll');
    const showMixer = !isHidden('mixer');
    const showTop = showRack || showPlaylist;

    const rows: Array<'top' | 'roll' | 'mixer'> = [];
    if (showTop) rows.push('top');
    if (showRoll) rows.push('roll');
    if (showMixer) rows.push('mixer');
    const flexRow = showRoll ? 'roll' : showMixer ? 'mixer' : 'top';
    const track = (r: 'top' | 'roll' | 'mixer'): string => (r === flexRow ? 'minmax(0, 1fr)' : r === 'top' ? `${fitted.topH}px` : `${fitted.mixerH}px`);
    const stageRows: string[] = [];
    rows.forEach((r, i) => {
      if (i > 0) stageRows.push(`${SPLITTER}px`);
      stageRows.push(track(r));
    });

    const stageH = size.height;
    const topCols = showRack && showPlaylist ? `${fitted.rackW}px ${SPLITTER}px minmax(0, 1fr)` : 'minmax(0, 1fr)';

    const stage: ReactNode[] = [];
    rows.forEach((r, i) => {
      const prev = rows[i - 1];
      if (prev) {
        // the splitter sits between two rows and resizes whichever of them has a fixed height
        const resizesTop = prev === 'top';
        stage.push(
          resizesTop ? (
            <Splitter key={`s${i}`} orientation="horizontal" label="Resize the top panels" value={fitted.topH} min={MIN_TOP_H} max={stageH - MIN_ROLL_H} onChange={(v) => workspaceLayout.resize({ topH: v })} />
          ) : (
            <Splitter key={`s${i}`} orientation="horizontal" label="Resize the mixer" invert value={fitted.mixerH} min={MIN_MIXER_H} max={stageH - MIN_TOP_H - MIN_ROLL_H} onChange={(v) => workspaceLayout.resize({ mixerH: v })} />
          ),
        );
      }
      if (r === 'top') {
        stage.push(
          <div key="top" className="stage-top" style={{ gridTemplateColumns: topCols }}>
            {showRack && frame('rack', bodies.rack)}
            {showRack && showPlaylist && <Splitter orientation="vertical" label="Resize the channel rack" value={fitted.rackW} min={MIN_RACK_W} max={size.width - fitted.browserW - MIN_PLAYLIST_W} onChange={(v) => workspaceLayout.resize({ rackW: v })} />}
            {showPlaylist && frame('playlist', bodies.playlist, badges.playlist)}
          </div>,
        );
      } else if (r === 'roll')
        stage.push(
          <div key="roll" className="stage-cell">
            {frame('roll', bodies.roll)}
          </div>,
        );
      else
        stage.push(
          <div key="mixer" className="stage-cell">
            {frame('mixer', bodies.mixer)}
          </div>,
        );
    });

    content = (
      <div
        className="workspace"
        style={
          {
            gridTemplateColumns: showBrowser ? `${fitted.browserW}px ${SPLITTER}px minmax(0, 1fr)` : 'minmax(0, 1fr)',
          } as CSSProperties
        }
      >
        {showBrowser && frame('browser', bodies.browser)}
        {showBrowser && <Splitter orientation="vertical" label="Resize the browser" value={fitted.browserW} min={MIN_BROWSER_W} max={MAX_BROWSER_W} onChange={(v) => workspaceLayout.resize({ browserW: v })} />}
        <div className="stage" style={{ gridTemplateRows: stageRows.join(' ') }}>
          {stage}
          {rows.length === 0 && floatIds.length === 0 && <p className="empty">Every panel is hidden. Use the View menu to show one.</p>}
        </div>
      </div>
    );
  }

  const floating = floatIds.map((id, i) => {
    const rect = windowRects[id];
    if (!rect) return null;
    return (
      <FloatingWindow
        key={id}
        id={id}
        rect={rect}
        bounds={bounds}
        order={i}
        active={i === floatIds.length - 1}
        folded={layout.folded.includes(id)}
        canMaximize={canDock}
        badge={badges[id]}
        tools={toolSlot(id)}
        onCommit={(r) => workspaceLayout.setRect(id, r)}
        onRaise={() => workspaceLayout.raise(id)}
        onFold={(f) => {
          workspaceLayout.fold(id, f);
          uiState.announce(`${PANEL_LABELS[id]} ${f ? 'collapsed to its title bar' : 'expanded'}.`);
        }}
        onDock={() => {
          workspaceLayout.dock(id);
          uiState.announce(`${PANEL_LABELS[id]} is docked again.`);
        }}
        onClose={() => {
          workspaceLayout.toggle(id);
          uiState.announce(`${PANEL_LABELS[id]} is closed. Show it again from the View menu.`);
        }}
        onMaximize={() => workspaceLayout.maximize(id)}
      >
        {bodies[id]}
      </FloatingWindow>
    );
  });

  return (
    <main className="workspace-box" id="workspace" ref={box}>
      {content}
      {floating.some(Boolean) && <div className="float-layer">{floating}</div>}
    </main>
  );
}
