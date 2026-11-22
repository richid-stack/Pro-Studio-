import { useId, type ReactNode } from 'react';
import { PANEL_LABELS, type PanelId } from '@pro-studio/shared';
import { Icon } from './Icon';

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
  children: ReactNode;
}

export function PanelFrame({ id, tools, maximized, canMaximize, onToggleMaximize, badge, children }: PanelFrameProps) {
  const titleId = useId();
  const title = PANEL_LABELS[id];
  return (
    <section className="panel" data-panel={id} data-maximized={maximized || undefined} aria-labelledby={titleId}>
      <header className="panel-header" onDoubleClick={canMaximize ? (e) => {
        if ((e.target as HTMLElement).closest('button, input, select, [role="slider"], [role="menu"]')) return;
        onToggleMaximize();
      } : undefined}>
        <h2 className="panel-title" id={titleId}>{title}</h2>
        {badge && <span className="panel-badge">{badge}</span>}
        <div className="panel-tools">{tools}</div>
        {canMaximize && (
          <button
            type="button"
            className="icon-btn"
            aria-label={maximized ? `Restore ${title}` : `Maximize ${title}`}
            aria-pressed={maximized}
            title={`${maximized ? 'Restore' : 'Maximize'} ${title} (Shift+F)`}
            onClick={onToggleMaximize}
          >
            <Icon name={maximized ? 'restore' : 'maximize'} />
          </button>
        )}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}
