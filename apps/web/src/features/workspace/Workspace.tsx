import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  MAX_BROWSER_W, MIN_BROWSER_W, MIN_MIXER_H, MIN_RACK_W, MIN_ROLL_H, MIN_TOP_H, MIN_PLAYLIST_W, SPLITTER, fitLayout, isFeatureVisible,
  type PanelId, type WorkspaceLayout,
} from '@pro-studio/shared';
import { PanelFrame } from '../../components/PanelFrame';
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
  const playlistOk = isFeatureVisible('playlist', mode);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((s) => (Math.abs(s.width - width) < 0.5 && Math.abs(s.height - height) < 0.5 ? s : { width, height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // the playlist belongs to Standard and up, whatever the saved layout says
  const hidden: readonly PanelId[] = playlistOk ? layout.hidden : [...new Set<PanelId>([...layout.hidden, 'playlist'])];
  const fitted: WorkspaceLayout = fitLayout({ ...layout, hidden }, { width: size.width, height: size.height, barH: 0 });
  const maximized = canDock ? layout.maximized : null;

  // the roll's tools live in its header, as in other DAWs; the roll renders into this slot (see PianoRoll's toolsHost)
  const [rollTools, setRollTools] = useState<HTMLElement | null>(null);

  const frame = (id: PanelId, body: ReactNode, badge?: string): ReactNode => (
    <PanelFrame
      id={id}
      maximized={maximized === id}
      canMaximize={canDock}
      onToggleMaximize={() => workspaceLayout.maximize(maximized === id ? null : id)}
      badge={badge}
      tools={id === 'roll' && !isMobile ? <div className="roll-tools-slot" ref={setRollTools} /> : undefined}
    >
      {body}
    </PanelFrame>
  );

  const bodies: Record<PanelId, ReactNode> = {
    browser: <Browser />,
    rack: <ChannelRack isMobile={isMobile} />,
    roll: <PianoRoll isMobile={isMobile} toolsHost={isMobile ? null : rollTools} />,
    playlist: <Playlist />,
    mixer: <Mixer />,
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
              <header className="panel-header"><h2 className="panel-title">Keys</h2></header>
              <div className="panel-body"><KeysDock /></div>
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
            {showRack && showPlaylist && (
              <Splitter orientation="vertical" label="Resize the channel rack" value={fitted.rackW} min={MIN_RACK_W} max={size.width - fitted.browserW - MIN_PLAYLIST_W} onChange={(v) => workspaceLayout.resize({ rackW: v })} />
            )}
            {showPlaylist && frame('playlist', bodies.playlist, badges.playlist)}
          </div>,
        );
      } else if (r === 'roll') stage.push(<div key="roll" className="stage-cell">{frame('roll', bodies.roll)}</div>);
      else stage.push(<div key="mixer" className="stage-cell">{frame('mixer', bodies.mixer)}</div>);
    });

    content = (
      <div className="workspace" style={{ gridTemplateColumns: showBrowser ? `${fitted.browserW}px ${SPLITTER}px minmax(0, 1fr)` : 'minmax(0, 1fr)' } as CSSProperties}>
        {showBrowser && frame('browser', bodies.browser)}
        {showBrowser && (
          <Splitter orientation="vertical" label="Resize the browser" value={fitted.browserW} min={MIN_BROWSER_W} max={MAX_BROWSER_W} onChange={(v) => workspaceLayout.resize({ browserW: v })} />
        )}
        <div className="stage" style={{ gridTemplateRows: stageRows.join(' ') }}>
          {stage}
          {rows.length === 0 && <p className="empty">Every panel is hidden. Use the View menu to show one.</p>}
        </div>
      </div>
    );
  }

  return (
    <main className="workspace-box" id="workspace" ref={box}>
      {content}
    </main>
  );
}
