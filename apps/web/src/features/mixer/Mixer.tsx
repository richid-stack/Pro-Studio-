import { memo } from 'react';
import { createPortal } from 'react-dom';
import { clearSolo, formatDb, formatPan, isFeatureVisible, setMasterDb, setMix, unmuteAll, type Channel } from '@pro-studio/shared';
import { Fader } from '../../components/Fader';
import { Knob } from '../../components/Knob';
import { Meter } from '../../components/Meter';
import { ToolButton, ToolGroup, Toolbar } from '../../components/Toolbar';
import { DEFAULT_CHANNEL_DB, channelColor } from '../../lib/channels';
import { studio, useProject } from '../../state/studio';
import { uiState, useUi } from '../../state/ui';
import { usePreferences } from '../../state/usePreferences';

const pct = (v: number): string => `${Math.round(v * 100)} percent`;

const Strip = memo(function Strip({ channel, selected, sends }: { channel: Channel; selected: boolean; sends: boolean }) {
  const m = channel.mix;
  const color = channelColor(channel);
  const set = (patch: Parameters<typeof setMix>[2], key: string): void => studio.edit((p) => setMix(p, channel.id, patch), { key: `${key}:${channel.id}` });
  return (
    <div className="strip" role="group" aria-label={`${channel.name} mixer strip`} data-selected={selected || undefined} data-muted={m.mute || undefined} style={{ '--ch': color } as React.CSSProperties}>
      <button type="button" className="strip-name" aria-current={selected || undefined} onClick={() => uiState.selectChannel(channel.id)} title={`Select ${channel.name}`}>
        {channel.name}
      </button>
      {sends && (
        <div className="strip-sends">
          <div className="send">
            <span aria-hidden="true">Rev</span>
            <Knob size="sm" label={`${channel.name} reverb send`} value={m.rev} min={0} max={1} step={0.01} defaultValue={0} format={pct} color={color} onChange={(v) => set({ rev: v }, 'rev')} />
          </div>
          <div className="send">
            <span aria-hidden="true">Dly</span>
            <Knob size="sm" label={`${channel.name} delay send`} value={m.dly} min={0} max={1} step={0.01} defaultValue={0} format={pct} color={color} onChange={(v) => set({ dly: v }, 'dly')} />
          </div>
          <div className="send">
            <span aria-hidden="true">Duck</span>
            <Knob size="sm" label={`${channel.name} duck amount`} value={m.duck} min={0} max={1} step={0.01} defaultValue={0} format={pct} color={color} onChange={(v) => set({ duck: v }, 'duck')} />
          </div>
        </div>
      )}
      <Knob label={`${channel.name} pan`} value={m.pan} min={-1} max={1} step={0.05} defaultValue={0} format={formatPan} bipolar color={color} onChange={(v) => set({ pan: v }, 'pan')} />
      <div className="strip-fader">
        <Fader label={`${channel.name} volume`} db={m.db} defaultDb={DEFAULT_CHANNEL_DB} color={color} onChange={(v) => set({ db: v }, 'db')} />
        <Meter source={{ channel: channel.id }} label={`${channel.name} level`} />
      </div>
      <output className="strip-db">{formatDb(m.db)}</output>
      <div className="strip-buttons">
        <button type="button" className="btn btn-toggle" data-kind="mute" aria-pressed={m.mute} aria-label={`Mute ${channel.name}`} onClick={() => set({ mute: !m.mute }, 'mute')}>
          M
        </button>
        <button type="button" className="btn btn-toggle" data-kind="solo" aria-pressed={m.solo} aria-label={`Solo ${channel.name}`} onClick={() => set({ solo: !m.solo }, 'solo')}>
          S
        </button>
      </div>
    </div>
  );
});

export function Mixer({ toolsHost }: { toolsHost: HTMLElement | null }) {
  const project = useProject();
  const selected = useUi((s) => s.selectedChannelId);
  const { mode } = usePreferences();
  const sends = isFeatureVisible('mixer-sends', mode);
  const anyMuted = project.channels.some((c) => c.mix.mute);
  const anySolo = project.channels.some((c) => c.mix.solo);
  const toolbar = (
    <Toolbar label="Mixer tools" className="mixer-toolbar">
      <ToolGroup label="Mute and solo">
        <ToolButton
          icon="mute"
          label="Unmute all"
          hint="Unmute every channel"
          hue="mute"
          disabled={!anyMuted}
          onClick={() => {
            studio.edit(unmuteAll);
            uiState.announce('Every channel is unmuted.');
          }}
        />
        <ToolButton
          icon="solo"
          label="Clear solo"
          hint="Take every channel out of solo"
          hue="snap"
          disabled={!anySolo}
          onClick={() => {
            studio.edit(clearSolo);
            uiState.announce('Solo cleared.');
          }}
        />
      </ToolGroup>
      <span className="muted mixer-hint">{project.channels.length} strips and master</span>
    </Toolbar>
  );
  return (
    <div className="mixer" data-header-tools={toolsHost ? '' : undefined}>
      {toolsHost ? createPortal(toolbar, toolsHost) : <div className="mixer-bar">{toolbar}</div>}
      <div className="mixer-strips">
        {project.channels.map((c) => (
          <Strip key={c.id} channel={c} selected={c.id === selected} sends={sends} />
        ))}
        {project.channels.length === 0 && <p className="empty">Add a channel and it appears here with its own fader.</p>}
      </div>
      <div className="strip strip-master" role="group" aria-label="Master strip">
        <span className="strip-name strip-name-static">Master</span>
        {sends && <div className="strip-sends strip-sends-spacer" aria-hidden="true" />}
        <span className="strip-pan-spacer" aria-hidden="true" />
        <div className="strip-fader">
          <Fader label="Master volume" db={project.masterDb} onChange={(v) => studio.edit((p) => setMasterDb(p, v), { key: 'master' })} />
          <Meter source={{ master: 'L' }} label="Master level, left" />
          <Meter source={{ master: 'R' }} label="Master level, right" />
        </div>
        <output className="strip-db">{formatDb(project.masterDb)}</output>
        <span className="strip-buttons strip-buttons-spacer" aria-hidden="true" />
      </div>
    </div>
  );
}
