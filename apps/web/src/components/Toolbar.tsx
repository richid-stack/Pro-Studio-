import { createContext, useContext, type KeyboardEvent, type ReactNode } from 'react';
import { usePreferences } from '../state/usePreferences';
import { Icon, type IconName } from './Icon';

/** Which tool a button belongs to. Each hue is a token (`--tool-*`) with a contrast pair; `plain` is the neutral outline. */
export type ToolHue = 'draw' | 'select' | 'erase' | 'mute' | 'snap' | 'plain';

const LabelsContext = createContext(false);

interface ToolbarProps {
  /** Accessible name of the toolbar. */
  label: string;
  className?: string;
  children: ReactNode;
}

/**
 * A row of tool buttons and fields in a panel's title bar. Left and Right move between buttons (the WAI-ARIA toolbar
 * pattern) while every control also stays in the normal Tab order. In Beginner the buttons carry text labels.
 */
export function Toolbar({ label, className, children }: ToolbarProps) {
  const { mode } = usePreferences();
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || !(e.target instanceof HTMLButtonElement) || e.altKey || e.ctrlKey || e.metaKey) return;
    const all = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button.tool-btn:not(:disabled)')];
    const at = all.indexOf(e.target);
    if (at < 0) return;
    e.preventDefault();
    all[(at + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length]?.focus();
  };
  return (
    <LabelsContext.Provider value={mode === 'beginner'}>
      {/* the toolbar pattern puts arrow-key handling on the container; the buttons inside are real, focusable buttons */}
      <div className={['tool-bar', className].filter(Boolean).join(' ')} role="toolbar" aria-label={label} onKeyDown={onKeyDown}>
        {children}
      </div>
    </LabelsContext.Provider>
  );
}

/** Tools that belong together, set off from the next group by a rule. */
export function ToolGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="tool-group" role="group" aria-label={label}>
      {children}
    </div>
  );
}

interface ToolButtonProps {
  icon: IconName;
  /** Accessible name, and the text shown beside the icon in Beginner. */
  label: string;
  /** Longer help for the tooltip: what it does and its shortcut. */
  hint?: string;
  hue?: ToolHue;
  pressed?: boolean;
  disabled?: boolean;
  /** The control exists but does nothing yet: the tooltip says so and the button is marked for tests and review. */
  preview?: boolean;
  onClick?: () => void;
}

export function ToolButton({ icon, label, hint, hue = 'plain', pressed, disabled, preview, onClick }: ToolButtonProps) {
  const labelled = useContext(LabelsContext);
  const tip = `${hint ?? label}${preview ? ' (preview: does nothing yet)' : ''}`;
  return (
    <button type="button" className="tool-btn" data-hue={hue} data-labeled={labelled || undefined} data-preview={preview || undefined} aria-label={label} aria-pressed={pressed} title={tip} disabled={disabled} onClick={onClick}>
      <Icon name={icon} size="sm" />
      {labelled && <span className="tool-text">{label}</span>}
    </button>
  );
}
