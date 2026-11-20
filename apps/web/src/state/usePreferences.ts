import { useSyncExternalStore } from 'react';
import { preferences, type Preferences } from './preferences';

export function usePreferences(): Preferences {
  return useSyncExternalStore(preferences.subscribe, preferences.get, preferences.get);
}
