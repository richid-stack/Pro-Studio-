import { useId, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { DETACH_DISTANCE, PANEL_LABELS, type PanelId } from '@pro-studio/shared';
import { Icon } from './Icon';
import { isWindowControl, startDrag } from './windowDrag';

interface PanelFrameProps {
  id: PanelId;
  /** Controls that belong in the header (tools, add buttons). */
  tools?: ReactNode;
  maximized: boolean;
  /** Maximizing is a Standard-and-up feature (dock-layouts). */
  canMaximize: boolean;
  onToggleMaximize: () => void;
  /** A short honest note shown in the header for panels that are previews. */
  badge?: string;
  /** Pop the panel out into a floating window (Standard and up). Shows the button. */
  onFloat?: () => void;
  /** The title bar was dragged far enough to pull the panel out; the pointer is handed to the new window. */
  onDetach?: (pointer: { clientX: number; clientY: number }) => void;
  children: ReactNode;
}

export function PanelFrame({ id, tools, maximized, canMaximize, onToggleMaximize, badge, onFloat, onDetach, children }: PanelFrameProps) {
  const titleId = useId();
  const title = PANEL_LABELS[id];

  // dragging the title bar of a docked panel pulls it out into a window once the pointer has travelled a little
  const onPointerDown = onDetach
    ? (e: ReactPointerEvent<HTMLElement>): void => {
        if (e.button !== 0 || isWindowControl(e.target)) return;
        let cancel = (): void => {};
        cancel = startDrag(e.clientX, e.clientY, 'detach', {
          move: (dx, dy, ev) => {
            if (Math.hypot(dx, dy) < DETACH_DISTANCE) return;
            cancel();
            onDetach({ clientX: ev.clientX, clientY: ev.clientY });
          },
          end: () => {},
        });
      }
    : undefined;

  return (
    <section className="panel" data-panel={id} data-maximized={maximized || undefined} aria-labelledby={titleId}>
      <header
        className="panel-header"
        data-detachable={onDetach ? 'true' : undefined}
        onPointerDown={onPointerDown}
        onDoubleClick={canMaximize ? (e) => {
          if (isWindowControl(e.target)) return;
          onToggleMaximize();
        } : undefined}
      >
        <h2 className="panel-title" id={titleId}>{title}</h2>
        {badge && <span className="panel-badge">{badge}</span>}
        <div className="panel-tools">{tools}</div>
        {onFloat && (
          <button type="button" className="wbtn" data-kind="float" aria-label={`Pop out ${title} into a window`} title={`Pop out ${title} into a window`} onClick={onFloat}>
            <Icon name="float" size="sm" />
          </button>
        )}
        {canMaximize && (
          <button
            type="button"
            className="wbtn"
            data-kind="maximize"
            aria-label={maximized ? `Restore ${title}` : `Maximize ${title}`}
            aria-pressed={maximized}
            title={`${maximized ? 'Restore' : 'Maximize'} ${title} (Shift+F)`}
            onClick={onToggleMaximize}
          >
            <Icon name={maximized ? 'restore' : 'maximize'} size="sm" />
          </button>
        )}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}
