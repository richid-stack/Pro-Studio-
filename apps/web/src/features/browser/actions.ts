/** What choosing an item in the browser does. The panel and the rack's drop target share these. */
import { SOUND_LIBRARY, addDrumChannel, addInstrumentChannel, createStarterProject, type Genre, type SoundEntry } from '@pro-studio/shared';
import { studio } from '../../state/studio';
import { uiState } from '../../state/ui';

/** The drag payload type: the id of a sound in the library. */
export const SOUND_DRAG_TYPE = 'application/x-prostudio-sound';

export function addSound(s: SoundEntry): void {
  let id = '';
  studio.edit((p) => {
    const r = s.kind === 'drum' ? addDrumChannel(p, s.drum) : addInstrumentChannel(p, s.inst);
    id = r.id;
    return r.project;
  });
  if (id) uiState.selectChannel(id);
  uiState.announce(`Added ${s.label} to the rack.`);
}

export function soundById(id: string): SoundEntry | undefined {
  return SOUND_LIBRARY.find((s) => s.id === id);
}

export function openStarter(genre: Genre, label: string): void {
  studio.replace(createStarterProject(genre));
  uiState.selectChannel(null);
  uiState.announce(`Opened the ${label} starter. Undo brings your previous project back.`);
}
