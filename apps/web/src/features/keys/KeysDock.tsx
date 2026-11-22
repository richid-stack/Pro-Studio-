import {} from 'react';
import { findChannel, midiName } from '@pro-studio/shared';
import { Icon } from '../../components/Icon';
import { Segmented } from '../../components/Segmented';
import { pianoActions, piano, pressNote, releaseNote, targetChannelId, usePianoUi } from '../../state/piano';
import { useHeldNotes } from '../../state/keys';
import { useProject } from '../../state/studio';
import { useUi } from '../../state/ui';
import { OnScreenKeys } from './OnScreenKeys';

/** The on-screen keys, for touch screens where there is no laptop keyboard. They play the channel selected in the rack. */
export function KeysDock() {
  const project = useProject();
  const selected = useUi((s) => s.selectedChannelId);
  const held = useHeldNotes();
  const base = usePianoUi((s) => s.baseMidi);
  const layout = usePianoUi((s) => s.layout);
  void layout; // subscribed so the key letters follow a layout change
  const codesByOffset = piano.keysByOffset();
  const targetId = targetChannelId();
  const target = targetId ? findChannel(project, targetId) : undefined;
  void selected;

  return (
    <div className="keys-dock">
      <div className="keys-bar">
        <span className="keys-target">Playing <strong>{target?.name ?? 'nothing yet'}</strong></span>
        <div className="stepper">
          <button type="button" className="icon-btn" aria-label="Move the keys down an octave" onClick={() => pianoActions.shiftOctave(-1)}>
            <Icon name="minus" />
          </button>
          <span className="readout-sm">{midiName(base)}</span>
          <button type="button" className="icon-btn" aria-label="Move the keys up an octave" onClick={() => pianoActions.shiftOctave(1)}>
            <Icon name="plus" />
          </button>
        </div>
        <Segmented
          label="Typing keyboard layout"
          value={layout}
          options={[{ value: 'fl', label: 'Two rows', hint: 'Z X C… and Q W E… play two octaves' }, { value: 'ableton', label: 'One row', hint: 'A S D F… play one octave' }]}
          onChange={(l) => pianoActions.setLayout(l)}
        />
      </div>
      <OnScreenKeys baseMidi={base} span={23} held={held} codesByOffset={codesByOffset} onPress={(n, id) => pressNote(id, n)} onRelease={(id) => releaseNote(id)} />
    </div>
  );
}
