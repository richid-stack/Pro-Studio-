import { useEffect, useSyncExternalStore } from 'react';
import { MOBILE_BREAKPOINT, findChannel } from '@pro-studio/shared';
import { studio, useProject } from './state/studio';
import { attachTypingPiano } from './state/piano';
import { uiState, useUi } from './state/ui';
import { StatusBar } from './features/StatusBar';
import { ExportDialog } from './features/dialogs/ExportDialog';
import { HelpDialog } from './features/dialogs/HelpDialog';
import { useGlobalShortcuts } from './features/shortcuts/useGlobalShortcuts';
import { TransportBar } from './features/transport/TransportBar';
import { Workspace } from './features/workspace/Workspace';

const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;
const subscribeWidth = (cb: () => void): (() => void) => {
  const mq = window.matchMedia(query);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
const useIsMobile = (): boolean => useSyncExternalStore(subscribeWidth, () => window.matchMedia(query).matches, () => false);

/** Keep a real channel selected, so the keys and the piano roll always have somewhere to play. */
function useEnsureSelection(): void {
  const project = useProject();
  const selected = useUi((s) => s.selectedChannelId);
  useEffect(() => {
    if (selected && findChannel(project, selected)) return;
    const first = project.channels.find((c) => c.type === 'inst') ?? project.channels[0];
    uiState.selectChannel(first?.id ?? null);
  }, [project, selected]);
}

export function App() {
  const isMobile = useIsMobile();
  useGlobalShortcuts(isMobile);
  useEnsureSelection();
  useEffect(() => {
    studio.syncNow();
    return attachTypingPiano();
  }, []);

  return (
    <div className="app">
      <a className="skip-link" href="#workspace">Skip to the workspace</a>
      <TransportBar isMobile={isMobile} />
      <Workspace isMobile={isMobile} />
      <StatusBar />
      <ExportDialog />
      <HelpDialog />
    </div>
  );
}
