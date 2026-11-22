import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from './Icon';

export type MenuItem =
  | { separator: true }
  | {
      label: string;
      onSelect: () => void;
      shortcut?: string;
      disabled?: boolean;
      /** Shows a check mark; the item then behaves as a toggle or a radio choice. */
      checked?: boolean;
      radio?: boolean;
    };

interface MenuButtonProps {
  /** Visible text. Leave out for an icon-only button and give `label` instead. */
  children?: ReactNode;
  /** Accessible name when there is no visible text. */
  label?: string;
  items: readonly MenuItem[];
  align?: 'start' | 'end';
  className?: string;
  /** Inside a menu bar: open state and arrow-key hand-over are owned by the bar. */
  bar?: { open: boolean; onOpen: () => void; onClose: () => void; onNavigate: (dir: -1 | 1) => void; hoverOpen: boolean };
  /** Tell the bar this trigger needs focus when it becomes the open one by keyboard. */
  triggerRef?: (el: HTMLButtonElement | null) => void;
}

/** A button that opens a menu. Follows the WAI-ARIA menu button pattern: arrows move, Escape closes and returns focus. */
export function MenuButton({ children, label, items, align = 'start', className, bar, triggerRef }: MenuButtonProps) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = bar ? bar.open : ownOpen;
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const id = useId();
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const close = (refocus: boolean): void => {
    if (bar) bar.onClose();
    else setOwnOpen(false);
    if (refocus) trigger.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const r = trigger.current.getBoundingClientRect();
    const w = popup.current?.offsetWidth ?? 0;
    const left = align === 'end' ? Math.max(8, r.right - w) : Math.min(r.left, Math.max(8, window.innerWidth - w - 8));
    setPos({ left, top: r.bottom });
  }, [open, align, items.length]);

  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    popup.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const away = (e: PointerEvent): void => {
      const t = e.target as Node;
      if (!popup.current?.contains(t) && !trigger.current?.contains(t)) close(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
    // close only reads props that are stable for as long as the menu is open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (bar) bar.onOpen();
      else setOwnOpen(true);
    } else if (bar && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      bar.onNavigate(e.key === 'ArrowLeft' ? -1 : 1);
    }
  };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    const buttons = [...(popup.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const go = (i: number): void => {
      e.preventDefault();
      buttons[(i + buttons.length) % buttons.length]?.focus();
    };
    if (e.key === 'ArrowDown') go(at + 1);
    else if (e.key === 'ArrowUp') go(at - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(buttons.length - 1);
    else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === 'Tab') close(false);
    else if (bar && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      bar.onNavigate(e.key === 'ArrowLeft' ? -1 : 1);
    }
  };

  return (
    <>
      <button
        ref={(el) => {
          trigger.current = el;
          triggerRef?.(el);
        }}
        type="button"
        className={className ?? 'menu-trigger'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        onClick={() => (bar ? (open ? bar.onClose() : bar.onOpen()) : setOwnOpen((o) => !o))}
        onPointerEnter={() => bar?.hoverOpen && !open && bar.onOpen()}
        onKeyDown={onTriggerKey}
      >
        {children ?? <Icon name="more" />}
      </button>
      {open && (
        <div
          ref={popup}
          id={id}
          className="menu-popup"
          role="menu"
          tabIndex={-1}
          aria-label={label}
          style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
          onKeyDown={onMenuKey}
        >
          {items.map((item, i) =>
            'separator' in item ? (
              <div key={`s${i}`} className="menu-separator" role="separator" />
            ) : (
              <button
                key={item.label}
                type="button"
                className="menu-item"
                role={item.checked === undefined ? 'menuitem' : item.radio ? 'menuitemradio' : 'menuitemcheckbox'}
                aria-checked={item.checked}
                disabled={item.disabled}
                onClick={() => {
                  close(true);
                  item.onSelect();
                }}
              >
                <span className="menu-check">{item.checked ? <Icon name="check" size="sm" /> : null}</span>
                <span className="menu-label">{item.label}</span>
                {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </>
  );
}

interface MenuBarProps {
  label: string;
  menus: ReadonlyArray<{ label: string; items: readonly MenuItem[] }>;
}

/** The File / Edit / View / Help row. Once one menu is open, moving across the bar opens its neighbours. */
export function MenuBar({ label, menus }: MenuBarProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const triggers = useRef<Array<HTMLButtonElement | null>>([]);

  const navigate = (from: number, dir: -1 | 1): void => {
    const next = (from + dir + menus.length) % menus.length;
    setOpenIndex(next);
    triggers.current[next]?.focus();
  };

  return (
    <div className="menubar" role="group" aria-label={label}>
      {menus.map((m, i) => (
        <MenuButton
          key={m.label}
          items={m.items}
          triggerRef={(el) => {
            triggers.current[i] = el;
          }}
          bar={{ open: openIndex === i, onOpen: () => setOpenIndex(i), onClose: () => setOpenIndex(null), onNavigate: (d) => navigate(i, d), hoverOpen: openIndex !== null }}
        >
          {m.label}
        </MenuButton>
      ))}
    </div>
  );
}
