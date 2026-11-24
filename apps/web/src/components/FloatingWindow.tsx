import { useEffect, useId, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { EDGES, MIN_FLOAT, PANEL_LABELS, isArrowKey, moveRect, nudgeRect, resizeRect, type Bounds, type Edge, type PanelId, type WindowRect } from '@pro-studio/shared';
import { Icon, type IconName } from './Icon';
import { isWindowControl, startDrag, takeHandOver } from './windowDrag';

interface FloatingWindowProps {
  id: PanelId;
  rect: WindowRect;
  bounds: Bounds;
  /** Place in the stack, 0 at the back. Becomes the z-index. */
  order: number;
  active: boolean;
  folded: boolean;
  canMaximize: boolean;
  tools?: ReactNode;
  badge?: string;
  /** A move or resize finished (or a key moved the window). */
  onCommit: (rect: WindowRect) => void;
  onRaise: () => void;
  onFold: (folded: boolean) => void;
  onDock: () => void;
  onClose: () => void;
  onMaximize: () => void;
  children: ReactNode;
}

function WinButton({ kind, icon, label, pressed, onClick }: { kind: string; icon: IconName; label: string; pressed?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="wbtn" data-kind={kind} aria-label={label} title={label} aria-pressed={pressed} onClick={onClick}>
      <Icon name={icon} size="sm" />
    </button>
  );
}

/**
 * A panel floating above the dock. Drag the title bar to move it, any edge or corner to resize it, double-click the
 * title bar to maximize it. The title is also a keyboard handle: arrows move, Shift+arrows resize, Ctrl goes four times faster.
 * While a drag is going the window follows the pointer from local state; the layout (and storage) is written once, on release.
 */
export function FloatingWindow(p: FloatingWindowProps) {
  const { id, bounds } = p;
  const title = PANEL_LABELS[id];
  const min = MIN_FLOAT[id];
  const titleId = useId();
  const hintId = useId();
  const [draft, setDraft] = useState<WindowRect | null>(null);
  const shown = draft ?? p.rect;

  const drag = (kind: string, x: number, y: number, next: (dx: number, dy: number) => WindowRect): void => {
    const start = p.rect;
    let last = start;
    startDrag(x, y, kind, {
      move: (dx, dy) => {
        last = next(dx, dy);
        setDraft(last);
      },
      end: (committed) => {
        setDraft(null);
        if (committed && (last.x !== start.x || last.y !== start.y || last.w !== start.w || last.h !== start.h)) p.onCommit(last);
      },
    });
  };
  const beginMove = (x: number, y: number): void => {
    const start = p.rect;
    drag('move', x, y, (dx, dy) => moveRect(start, dx, dy, min, bounds));
  };
  const beginResize = (edge: Edge, x: number, y: number): void => {
    const start = p.rect;
    drag(`resize-${edge}`, x, y, (dx, dy) => resizeRect(start, edge, dx, dy, min, bounds));
  };

  // a panel pulled out of the dock arrives with the pointer still down: carry on dragging it from here
  useEffect(() => {
    const h = takeHandOver(id);
    if (h) beginMove(h.clientX, h.clientY);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount: the hand-over is consumed once
  }, []);

  const onGrabKey = (e: KeyboardEvent<HTMLButtonElement>): void => {
    if (!isArrowKey(e.key) || e.altKey) return;
    e.preventDefault();
    e.stopPropagation();
    p.onCommit(nudgeRect(p.rect, e.key, { resize: e.shiftKey, fast: e.ctrlKey || e.metaKey }, min, bounds));
  };

  const style: CSSProperties = { left: shown.x, top: shown.y, width: shown.w, height: p.folded ? undefined : shown.h, zIndex: p.order + 1 };

  return (
    <section
      className="panel fwin"
      data-panel={id}
      data-floating="true"
      data-active={p.active || undefined}
      data-folded={p.folded || undefined}
      data-dragging={draft ? 'true' : undefined}
      aria-labelledby={titleId}
      style={style}
      onPointerDownCapture={p.onRaise}
      onFocusCapture={p.onRaise}
    >
      <header
        className="panel-header fwin-bar"
        onPointerDown={(e) => {
          if (e.button !== 0 || isWindowControl(e.target)) return;
          beginMove(e.clientX, e.clientY);
        }}
        onDoubleClick={(e) => {
          if (p.canMaximize && !isWindowControl(e.target)) p.onMaximize();
        }}
      >
        <h2 className="panel-title" id={titleId}>
          <button type="button" className="fwin-grab" data-grab aria-describedby={hintId} onKeyDown={onGrabKey}>
            {title}
          </button>
        </h2>
        <span className="visually-hidden" id={hintId}>
          Window. Arrow keys move it. Shift and arrow keys resize it. Hold Control to go four times as far.
        </span>
        {p.badge && <span className="panel-badge">{p.badge}</span>}
        <div className="panel-tools">{p.tools}</div>
        <div className="fwin-buttons" role="group" aria-label={`${title} window`}>
          <WinButton kind="fold" icon={p.folded ? 'restore' : 'minimize'} label={p.folded ? `Expand ${title}` : `Collapse ${title} to its title bar`} pressed={p.folded} onClick={() => p.onFold(!p.folded)} />
          {p.canMaximize && <WinButton kind="maximize" icon="maximize" label={`Maximize ${title}`} onClick={p.onMaximize} />}
          <WinButton kind="dock" icon="dock" label={`Dock ${title} back into the layout`} onClick={p.onDock} />
          <WinButton kind="close" icon="close" label={`Close ${title}`} onClick={p.onClose} />
        </div>
      </header>
      <div className="panel-body" hidden={p.folded}>
        {p.children}
      </div>
      {!p.folded &&
        EDGES.map((edge) => (
          <div
            key={edge}
            className="fwin-edge"
            data-edge={edge}
            aria-hidden="true"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              beginResize(edge, e.clientX, e.clientY);
            }}
          />
        ))}
    </section>
  );
}
