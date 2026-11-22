import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Buttons at the bottom. */
  actions?: ReactNode;
}

/** A modal dialog on the native <dialog> element: focus is trapped, Escape closes, and focus returns to what opened it. */
export function Dialog({ open, onClose, title, children, actions }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    // Clicking the backdrop closes the dialog as a mouse convenience; Escape closes a native dialog from the keyboard.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-body">
        <div className="dialog-head">
          <h2 id={titleId} className="dialog-title">{title}</h2>
          <button type="button" className="icon-btn" aria-label={`Close ${title}`} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="dialog-content">{children}</div>
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </dialog>
  );
}
