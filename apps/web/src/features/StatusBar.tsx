import { useSyncExternalStore } from 'react';
import { isFeatureVisible } from '@pro-studio/shared';
import { audioHost } from '../audio/audioHost';
import { useUi } from '../state/ui';
import { usePreferences } from '../state/usePreferences';

/** The hint line at the bottom. It is also the polite live region that tells screen readers what an action did. */
export function StatusBar() {
  const message = useUi((s) => s.announcement);
  const { mode } = usePreferences();
  const status = useSyncExternalStore(audioHost.subscribeStatus, audioHost.getStatus, audioHost.getStatus);
  const technical = isFeatureVisible('numeric-readouts', mode);
  return (
    <footer className="statusbar">
      <p className="status-message" role="status" aria-live="polite">{message || 'Press ? for keyboard shortcuts.'}</p>
      {technical && <span className="status-tech">Engine {status}</span>}
    </footer>
  );
}
