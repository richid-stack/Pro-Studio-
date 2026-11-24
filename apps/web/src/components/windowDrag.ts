/**
 * Pointer dragging for windows, without React: listeners live on `window` for the length of one drag, so a drag keeps
 * working when the pointer leaves the title bar or the browser tab's content, and Escape cancels it.
 */
export interface DragHandlers {
  /** Called on every pointer move with the distance from where the drag began. */
  move: (dx: number, dy: number, ev: PointerEvent) => void;
  /** Called once. `committed` is false when the drag was cancelled with Escape or the pointer was lost. */
  end: (committed: boolean) => void;
}

const ROOT_ATTR = 'data-window-drag';

/** Start a drag from the given pointer position. Returns a function that cancels it. */
export function startDrag(startX: number, startY: number, kind: string, handlers: DragHandlers): () => void {
  const root = document.documentElement;
  root.setAttribute(ROOT_ATTR, kind);
  let done = false;
  const finish = (committed: boolean): void => {
    if (done) return;
    done = true;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('keydown', onKey, true);
    root.removeAttribute(ROOT_ATTR);
    handlers.end(committed);
  };
  const onMove = (ev: PointerEvent): void => handlers.move(ev.clientX - startX, ev.clientY - startY, ev);
  const onUp = (): void => finish(true);
  const onCancel = (): void => finish(false);
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key !== 'Escape') return;
    ev.preventDefault();
    ev.stopPropagation();
    finish(false);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  window.addEventListener('keydown', onKey, true);
  return () => finish(false);
}

/** A docked panel that was just pulled out into a window hands its pointer over to the new window. */
export interface HandOver {
  id: string;
  clientX: number;
  clientY: number;
}
let pending: HandOver | null = null;
export const handOverDrag = (h: HandOver): void => {
  pending = h;
};
export function takeHandOver(id: string): HandOver | null {
  if (!pending || pending.id !== id) return null;
  const h = pending;
  pending = null;
  return h;
}

/** True for a pointer or key target that should keep its own behaviour instead of starting a window drag. */
export const isWindowControl = (el: EventTarget | null): boolean =>
  el instanceof Element && el.closest('button:not([data-grab]), input, select, textarea, a, [role="slider"], [role="menu"], [role="menuitem"], [data-no-window-drag]') !== null;
