import { useEffect } from 'react';
import { PANEL_FOR_TOGGLE, isEditableTarget, matchShortcut, type PanelId, type ShortcutId } from '@pro-studio/shared';
import { exportDialog } from '../dialogs/ExportDialog';
import { openProjectFile, saveProjectFile } from '../../state/files';
import { studio } from '../../state/studio';
import { transport } from '../../state/transport';
import { uiState, workspaceLayout } from '../../state/ui';

const INTERACTIVE = 'button, a[href], select, summary, [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"]';

/** The panel the keyboard focus is in, found from the DOM, for "maximize this panel". */
export function focusedPanel(): PanelId | null {
  const el = document.activeElement?.closest<HTMLElement>('[data-panel]');
  return (el?.dataset.panel as PanelId | undefined) ?? null;
}

/** Run a shortcut by id. Shared by the key handler and by the menus, so a command does the same thing either way. */
export function runShortcut(id: ShortcutId, isMobile: boolean): void {
  switch (id) {
    case 'play-pause':
      transport.toggle();
      break;
    case 'stop':
      transport.stop();
      break;
    case 'undo':
      if (studio.canUndo()) {
        studio.undo();
        uiState.announce('Undone.');
      }
      break;
    case 'redo':
      if (studio.canRedo()) {
        studio.redo();
        uiState.announce('Redone.');
      }
      break;
    case 'save':
      saveProjectFile();
      break;
    case 'open':
      openProjectFile();
      break;
    case 'export':
      exportDialog.open();
      break;
    case 'help':
      uiState.setHelp(true);
      break;
    case 'maximize': {
      const p = focusedPanel();
      const current = workspaceLayout.get().maximized;
      if (current) workspaceLayout.maximize(null);
      else if (p) workspaceLayout.maximize(p);
      break;
    }
    default: {
      const panel = PANEL_FOR_TOGGLE[id];
      if (!panel) break;
      if (isMobile) uiState.setMobilePanel(panel);
      else workspaceLayout.toggle(panel);
    }
  }
}

export function useGlobalShortcuts(isMobile: boolean): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented) return;
      const target = e.target as Element | null;
      const id = matchShortcut({
        key: e.key,
        code: e.code,
        shift: e.shiftKey,
        mod: e.ctrlKey || e.metaKey,
        alt: e.altKey,
        editable: isEditableTarget(target),
        interactive: Boolean(target?.closest?.(INTERACTIVE)),
        modalOpen: Boolean(document.querySelector('dialog[open]')),
      });
      if (!id) return;
      e.preventDefault();
      if (e.repeat && id !== 'undo' && id !== 'redo') return;
      runShortcut(id, isMobile);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobile]);
}
