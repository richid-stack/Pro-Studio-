import { createPortal } from 'react-dom';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent } from 'react';
import { SOUND_LIBRARY, STEP_TICKS, clearChannel, speakDb, formatPan, gridMove, isFeatureVisible, moveChannel, removeChannel, renameChannel, setMix, toggleStep, totalSteps, type Channel, type DrumChannel } from '@pro-studio/shared';
import { audioHost } from '../../audio/audioHost';
import { Icon } from '../../components/Icon';
import { ToolGroup, Toolbar } from '../../components/Toolbar';
import { Knob } from '../../components/Knob';
import { MenuButton, type MenuItem } from '../../components/Menu';
import { SOUND_DRAG_TYPE, addSound, soundById } from '../browser/actions';
import { DEFAULT_CHANNEL_DB, channelColor, channelKind } from '../../lib/channels';
import { studio, useProject } from '../../state/studio';
import { uiState, useUi } from '../../state/ui';
import { usePreferences } from '../../state/usePreferences';
import { StepEditor, type StepEditorTarget } from './StepEditor';

interface RowProps {
  channel: Channel;
  row: number;
  steps: number;
  selected: boolean;
  canEditSteps: boolean;
  isMobile: boolean;
  cell: { row: number; col: number };
  onCell: (row: number, col: number) => void;
  onOpenEditor: (t: StepEditorTarget) => void;
  last: boolean;
}

const RackRow = memo(function RackRow({ channel, row, steps, selected, canEditSteps, isMobile, cell, onCell, onOpenEditor, last }: RowProps) {
  const [renaming, setRenaming] = useState(false);
  const paint = useRef<{ on: boolean } | null>(null);
  const viaPointer = useRef(false);
  const drum = channel.type === 'drum' ? channel : null;
  const color = channelColor(channel);

  const setStep = (i: number, on: boolean): void => {
    const current = studio.get().channels.find((c) => c.id === channel.id);
    if (!current || current.type !== 'drum') return;
    if ((current.v[i] ?? 0) > 0 !== on) studio.edit((p) => toggleStep(p, channel.id, i));
  };

  const stepAt = (el: Element | null): number | null => {
    const b = el?.closest<HTMLElement>('[data-step]');
    return b && b.dataset.ch === channel.id ? Number(b.dataset.col) : null;
  };

  const down = (e: PointerEvent<HTMLDivElement>): void => {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    const i = stepAt(e.target as Element);
    if (i === null || !drum) return;
    viaPointer.current = true;
    const wasOn = (drum.v[i] ?? 0) > 0;
    paint.current = { on: !wasOn };
    e.currentTarget.setPointerCapture(e.pointerId);
    setStep(i, !wasOn);
    onCell(row, i);
  };
  const move = (e: PointerEvent<HTMLDivElement>): void => {
    if (!paint.current) return;
    const i = stepAt(document.elementFromPoint(e.clientX, e.clientY));
    if (i !== null) setStep(i, paint.current.on);
  };
  const up = (): void => {
    paint.current = null;
  };
  const click = (e: React.MouseEvent<HTMLDivElement>): void => {
    // Pointer presses were handled on pointer down; this is a tap on a touch screen or the keyboard.
    if (viaPointer.current) {
      viaPointer.current = false;
      return;
    }
    const i = stepAt(e.target as Element);
    if (i === null) return;
    studio.edit((p) => toggleStep(p, channel.id, i));
    onCell(row, i);
  };
  const openEditor = (e: React.MouseEvent<HTMLElement>): void => {
    const i = stepAt(e.target as Element);
    if (i === null || !canEditSteps) return;
    e.preventDefault();
    const r = (e.target as HTMLElement).closest('[data-step]')!.getBoundingClientRect();
    onOpenEditor({ channelId: channel.id, step: i, rect: { left: r.left, top: r.top, bottom: r.bottom } });
  };

  const menu: MenuItem[] = [
    { label: 'Rename', onSelect: () => setRenaming(true) },
    ...(drum ? ([{ label: 'Clear steps', onSelect: () => studio.edit((p) => clearChannel(p, channel.id)) }] as MenuItem[]) : []),
    {
      label: 'Move up',
      disabled: row === 0,
      onSelect: () => studio.edit((p) => moveChannel(p, channel.id, row - 1)),
    },
    {
      label: 'Move down',
      disabled: last,
      onSelect: () => studio.edit((p) => moveChannel(p, channel.id, row + 1)),
    },
    { separator: true },
    {
      label: 'Delete channel',
      onSelect: () => {
        studio.edit((p) => removeChannel(p, channel.id));
        uiState.announce(`Deleted ${channel.name}. Press Undo to bring it back.`);
      },
    },
  ];

  return (
    <div className="rack-row" role="group" aria-label={channel.name} data-selected={selected || undefined} data-muted={channel.mix.mute || undefined} style={{ '--ch': color } as React.CSSProperties}>
      <div className="rack-head">
        <button type="button" className="led" aria-pressed={channel.mix.mute} aria-label={`Mute ${channel.name}`} title={channel.mix.mute ? `Unmute ${channel.name}` : `Mute ${channel.name}`} onClick={() => studio.edit((p) => setMix(p, channel.id, { mute: !channel.mix.mute }))} />
        {renaming ? (
          <input
            className="rename"
            aria-label={`Rename ${channel.name}`}
            defaultValue={channel.name}
            maxLength={24}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => {
              studio.edit((p) => renameChannel(p, channel.id, e.currentTarget.value));
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                e.currentTarget.value = channel.name;
                e.currentTarget.blur();
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="channel-name"
            aria-current={selected || undefined}
            title={`${channelKind(channel)}. ${channel.type === 'inst' ? 'Select to play it and edit its notes.' : 'Select to play it from the keyboard.'}`}
            onClick={() => {
              uiState.selectChannel(channel.id);
              if (isMobile && channel.type === 'inst') uiState.setMobilePanel('roll');
            }}
          >
            {channel.name}
          </button>
        )}
        <Knob label={`${channel.name} volume`} value={channel.mix.db} min={-60} max={6} step={0.5} defaultValue={DEFAULT_CHANNEL_DB} format={speakDb} color={color} size="sm" onChange={(v) => studio.edit((p) => setMix(p, channel.id, { db: v }), { key: `db:${channel.id}` })} />
        <Knob label={`${channel.name} pan`} value={channel.mix.pan} min={-1} max={1} step={0.05} defaultValue={0} format={formatPan} bipolar color={color} size="sm" onChange={(v) => studio.edit((p) => setMix(p, channel.id, { pan: v }), { key: `pan:${channel.id}` })} />
        <MenuButton label={`${channel.name} options`} className="icon-btn" items={menu} align="end" />
      </div>

      {drum ? (
        // Each step is a real button, so Enter and Space work natively; this container only paints across steps with a pointer.
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div className="rack-steps" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={click} onContextMenu={openEditor} onDoubleClick={openEditor}>
          {Array.from({ length: steps }, (_, i) => {
            const v = drum.v[i] ?? 0;
            const on = v > 0;
            const r = drum.r[i] ?? 1;
            return (
              <button
                key={i}
                type="button"
                className="step"
                data-step=""
                data-ch={channel.id}
                data-row={row}
                data-col={i}
                data-on={on || undefined}
                data-group={(i >> 2) & 1}
                data-bar={i % 16 === 0 || undefined}
                data-ratchet={on && r > 1 ? r : undefined}
                style={{ '--vel': v } as React.CSSProperties}
                tabIndex={cell.row === row && cell.col === i ? 0 : -1}
                aria-pressed={on}
                aria-label={`${channel.name}, step ${i + 1}${on ? `, on, velocity ${Math.round(v * 100)} percent${r > 1 ? `, ${r} hits` : ''}` : ''}`}
                onFocus={() => onCell(row, i)}
              />
            );
          })}
        </div>
      ) : (
        <InstrumentSummary
          channel={channel}
          steps={steps}
          onOpen={() => {
            uiState.selectChannel(channel.id);
            if (isMobile) uiState.setMobilePanel('roll');
          }}
        />
      )}
    </div>
  );
});

/** An instrument row shows where its notes fall, as a strip under the step columns. Notes are edited in the piano roll. */
function InstrumentSummary({ channel, steps, onOpen }: { channel: Channel; steps: number; onOpen: () => void }) {
  if (channel.type !== 'inst') return null;
  return (
    <button type="button" className="rack-notes" onClick={onOpen} aria-label={`${channel.name}: ${channel.notes.length} notes. Open in the piano roll.`} title="Edit these notes in the piano roll" style={{ '--steps': steps } as React.CSSProperties}>
      {channel.notes.map((n) => (
        <span
          key={n.id}
          className="rack-note"
          style={{
            left: `calc(${n.t} * var(--step-w))`,
            width: `calc(${n.d} * var(--step-w))`,
            opacity: 0.45 + n.v * 0.55,
          }}
        />
      ))}
      {channel.notes.length === 0 && <span className="rack-notes-empty">No notes yet. Open the piano roll to add some.</span>}
    </button>
  );
}

export function ChannelRack({ isMobile, toolsHost }: { isMobile: boolean; toolsHost: HTMLElement | null }) {
  const project = useProject();
  const selectedId = useUi((s) => s.selectedChannelId);
  const { mode } = usePreferences();
  const canEditSteps = isFeatureVisible('step-editor', mode);
  const steps = totalSteps(project);
  const [cell, setCell] = useState({ row: 0, col: 0 });
  const [editor, setEditor] = useState<StepEditorTarget | null>(null);
  const table = useRef<HTMLDivElement>(null);

  const onCell = useCallback((row: number, col: number) => setCell((c) => (c.row === row && c.col === col ? c : { row, col })), []);

  // the playhead is one element moved by a CSS variable, not a re-render per step
  useEffect(() => {
    const paint = (): void => {
      const t = audioHost.getTransport();
      table.current?.style.setProperty('--ps', t.playing ? String(Math.floor(t.loopTick / STEP_TICKS)) : '-1');
    };
    paint();
    return audioHost.subscribeTelemetry(paint);
  }, []);

  const key = (e: KeyboardEvent<HTMLDivElement>): void => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-step]');
    if (!el) return;
    const rowCount = project.channels.length;
    const next = gridMove(Number(el.dataset.row), Number(el.dataset.col), e.key, rowCount, steps);
    if (!next) return;
    let target = table.current?.querySelector<HTMLElement>(`[data-step][data-row="${next.row}"][data-col="${next.col}"]`);
    // skip over instrument rows, which have no steps, when moving up or down
    let r = next.row;
    while (!target && r >= 0 && r < rowCount) {
      r += e.key === 'ArrowUp' ? -1 : 1;
      target = table.current?.querySelector<HTMLElement>(`[data-step][data-row="${r}"][data-col="${next.col}"]`);
    }
    if (!target) return;
    e.preventDefault();
    target.focus();
  };

  const adders: MenuItem[] = useMemo(() => SOUND_LIBRARY.map((s): MenuItem => ({ label: s.label, onSelect: () => addSound(s) })), []);
  const toolbar = (
    <Toolbar label="Channel rack tools" className="rack-toolbar">
      <ToolGroup label="Add">
        <MenuButton className="tool-btn tool-btn-text" items={adders} label="Add channel">
          <Icon name="plus" size="sm" />
          <span>Add channel</span>
        </MenuButton>
      </ToolGroup>
      <span className="muted rack-hint">
        {project.channels.length} channels, {steps} steps
      </span>
    </Toolbar>
  );

  // a sound dragged from the browser is added when it is dropped anywhere on the rack
  const [dropping, setDropping] = useState(false);
  const isSoundDrag = (e: DragEvent<HTMLElement>): boolean => e.dataTransfer.types.includes(SOUND_DRAG_TYPE);

  const editorChannel = editor ? (project.channels.find((c) => c.id === editor.channelId) as DrumChannel | undefined) : undefined;

  return (
    <div
      className="rack"
      data-header-tools={toolsHost ? '' : undefined}
      data-dropping={dropping || undefined}
      onDragOver={(e) => {
        if (!isSoundDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDropping(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false);
      }}
      onDrop={(e) => {
        setDropping(false);
        if (!isSoundDrag(e)) return;
        e.preventDefault();
        const sound = soundById(e.dataTransfer.getData(SOUND_DRAG_TYPE));
        if (sound) addSound(sound);
      }}
    >
      {toolsHost ? createPortal(toolbar, toolsHost) : <div className="rack-bar">{toolbar}</div>}
      {/* Arrow-key movement between step buttons is handled once here; the buttons themselves are focusable. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div className="rack-scroll" onKeyDown={key}>
        <div className="rack-table" role="group" aria-label="Channel rack steps" ref={table} style={{ '--steps': steps } as React.CSSProperties}>
          {project.channels.map((c, i) => (
            <RackRow key={c.id} channel={c} row={i} steps={steps} selected={c.id === selectedId} canEditSteps={canEditSteps} isMobile={isMobile} cell={cell} onCell={onCell} onOpenEditor={setEditor} last={i === project.channels.length - 1} />
          ))}
          <div className="rack-playhead" aria-hidden="true" />
        </div>
        {project.channels.length === 0 && <p className="empty">No channels yet. Choose Add channel to start a beat.</p>}
      </div>
      {editor && editorChannel && <StepEditor target={editor} channel={editorChannel} onClose={() => setEditor(null)} />}
    </div>
  );
}
