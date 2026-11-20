import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  TypingPiano,
  createTypingInput,
  detectChord,
  isFeatureVisible,
  midiName,
  mtof,
  type KeyLayout,
  type PianoEvent,
} from '@forge/shared';
import { keyEngine, type AudioStatus } from '../../audio/engine';
import { PRESETS, type PresetId } from '../../audio/keySynth';
import { Segmented } from '../../components/Segmented';
import { usePreferences } from '../../state/usePreferences';
import { OnScreenKeys } from './OnScreenKeys';

const LAYOUT_OPTIONS = [
  { value: 'ableton', label: 'Home row', hint: 'A S D F… play white keys, W E T… play black keys' },
  { value: 'fl', label: 'Two rows', hint: 'Z X C… and Q W E… play two octaves' },
] as const satisfies readonly { value: KeyLayout; label: string; hint: string }[];

const SPAN: Record<KeyLayout, number> = { ableton: 17, fl: 28 };

const HOW_TO: Record<KeyLayout, { notes: string; extra: string }> = {
  ableton: {
    notes: 'The home row (A S D F G H J K L) plays the white keys. The row above (W E T Y U O P) plays the black keys.',
    extra: 'Z and X move the keys down or up an octave. C and V change how hard you play.',
  },
  fl: {
    notes: 'The bottom row (Z X C V B N M) plays one octave and the row above it (Q W E R T Y U) plays the next one up.',
    extra: '− and = move the keys down or up an octave.',
  },
};

const STATUS_TEXT: Record<AudioStatus, string> = {
  idle: 'Sound starts when you play your first note.',
  running: 'Sound is on.',
  suspended: 'The browser paused sound. Play a note to resume.',
  unsupported: 'This browser cannot play Web Audio.',
};

function loudnessWord(velocity: number): string {
  if (velocity < 48) return 'soft';
  if (velocity < 96) return 'medium';
  return 'loud';
}

export function KeysPanel() {
  const { mode } = usePreferences();
  const show = (id: string) => isFeatureVisible(id, mode);

  const [piano] = useState(() => new TypingPiano());
  const [layout, setLayout] = useState<KeyLayout>(piano.layout);
  const [enabled, setEnabled] = useState(true);
  const [baseMidi, setBaseMidi] = useState(piano.baseMidi);
  const [velocity, setVelocity] = useState(piano.velocity);
  const [preset, setPreset] = useState<PresetId>('keys');
  const [held, setHeld] = useState<ReadonlyMap<string, number>>(new Map());
  const audio = useSyncExternalStore(keyEngine.subscribe, keyEngine.getStatus, keyEngine.getStatus);

  const stopSource = useCallback((code: string) => {
    keyEngine.noteOff(code);
    setHeld((m) => {
      if (!m.has(code)) return m;
      const next = new Map(m);
      next.delete(code);
      return next;
    });
  }, []);

  const emit = useCallback(
    (ev: PianoEvent) => {
      switch (ev.type) {
      case 'noteOn':
        keyEngine.noteOn(ev.note, ev.velocity, ev.code);
        setHeld((m) => new Map(m).set(ev.code, ev.note));
        break;
      case 'noteOff':
        stopSource(ev.code);
        break;
      case 'octave':
        setBaseMidi(ev.baseMidi);
        break;
      case 'velocity':
        setVelocity(ev.velocity);
        break;
      }
    },
    [stopSource],
  );

  const input = useMemo(() => createTypingInput(piano, emit), [piano, emit]);

  const releaseEverything = useCallback(() => {
    input.blur();
    keyEngine.allNotesOff();
    setHeld(new Map());
  }, [input]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => input.keyDown(e);
    const up = (e: KeyboardEvent) => input.keyUp(e);
    const hide = () => {
      if (document.hidden) releaseEverything();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', releaseEverything);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', releaseEverything);
      document.removeEventListener('visibilitychange', hide);
      releaseEverything();
    };
  }, [input, releaseEverything]);

  const heldNotes = useMemo(() => [...new Set(held.values())].sort((a, b) => a - b), [held]);
  const heldSet = useMemo(() => new Set(heldNotes), [heldNotes]);
  const codesByOffset = useMemo(() => piano.keysByOffset(), [piano, layout]);
  const chord = heldNotes.length >= 3 ? detectChord(heldNotes) : null;

  const changeLayout = (next: KeyLayout) => {
    piano.setLayout(next).forEach(emit);
    setLayout(next);
  };
  const toggleEnabled = () => {
    const next = !enabled;
    piano.setEnabled(next).forEach(emit);
    setEnabled(next);
  };
  const changePreset = (id: PresetId) => {
    keyEngine.setPreset(id);
    setPreset(id);
  };
  const press = (note: number, pointerId: number) => emit({ type: 'noteOn', note, velocity: piano.velocity, code: `pointer:${pointerId}` });
  const release = (pointerId: number) => stopSource(`pointer:${pointerId}`);

  const plain = show('plain-language');
  const howTo = HOW_TO[layout];

  return (
    <section className="panel" aria-labelledby="keys-title">
      <header className="panel-head">
        <h2 id="keys-title" className="panel-title">
          Keyboard piano
        </h2>
        <button type="button" className="btn" aria-pressed={enabled} onClick={toggleEnabled}>
          {enabled ? 'Computer keys on' : 'Computer keys off'}
        </button>
      </header>

      <div className="panel-body">
        <div className="control-row">
          <div className="control">
            <span className="t-label">Sound</span>
            <Segmented
              label="Sound"
              value={preset}
              options={PRESETS.map((p) => ({ value: p.id, label: p.label, hint: p.hint }))}
              onChange={changePreset}
            />
          </div>
          <div className="control">
            <span className="t-label">Key layout</span>
            <Segmented label="Key layout" value={layout} options={LAYOUT_OPTIONS} onChange={changeLayout} />
          </div>
          <div className="control">
            <span className="t-label">{plain ? 'Higher or lower' : 'Octave'}</span>
            <div className="stepper">
              <button type="button" className="btn" aria-label="Octave down" onClick={() => piano.shiftOctave(-1).forEach(emit)}>
                −
              </button>
              <span className="readout t-num">
                {plain ? `Starts at ${midiName(baseMidi)}` : midiName(baseMidi)}
              </span>
              <button type="button" className="btn" aria-label="Octave up" onClick={() => piano.shiftOctave(1).forEach(emit)}>
                +
              </button>
            </div>
          </div>
          {layout === 'ableton' && (
            <div className="control">
              <span className="t-label">{plain ? 'Loudness' : 'Velocity'}</span>
              <div className="stepper">
                <button type="button" className="btn" aria-label="Velocity down" onClick={() => piano.stepVelocity(-1).forEach(emit)}>
                  −
                </button>
                <span className="readout t-num">
                  {plain ? loudnessWord(velocity) : velocity}
                </span>
                <button type="button" className="btn" aria-label="Velocity up" onClick={() => piano.stepVelocity(1).forEach(emit)}>
                  +
                </button>
              </div>
            </div>
          )}
        </div>

        <OnScreenKeys
          baseMidi={baseMidi}
          span={SPAN[layout]}
          held={heldSet}
          codesByOffset={codesByOffset}
          onPress={press}
          onRelease={release}
        />

        <div className="readouts">
          <p className="playing">
            <span className="t-label">Playing</span>{' '}
            <span className="t-num">
              {chord ? chord.symbol : heldNotes.length ? heldNotes.map((n) => midiName(n)).join(' ') : '—'}
            </span>
          </p>
          <p className="t-hint" role="status">
            {STATUS_TEXT[audio]}
          </p>
        </div>

        {show('numeric-readouts') && (
          <table className="numeric" aria-label="Held notes">
            <thead>
              <tr>
                <th scope="col">Note</th>
                <th scope="col">MIDI</th>
                <th scope="col">Hz</th>
              </tr>
            </thead>
            <tbody>
              {heldNotes.length === 0 ? (
                <tr>
                  <td colSpan={3}>No notes held</td>
                </tr>
              ) : (
                heldNotes.map((n) => (
                  <tr key={n}>
                    <td>{midiName(n)}</td>
                    <td className="t-num">{n}</td>
                    <td className="t-num">{mtof(n).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {show('coach-marks') ? (
          <div className="coach" role="note">
            <h3 className="coach-title">How to play</h3>
            <p>{howTo.notes}</p>
            <p>{howTo.extra}</p>
            <p>Hold A, D and G together to hear a chord. You can also click or tap the keys above.</p>
          </div>
        ) : (
          <p className="t-hint">
            {howTo.notes} {howTo.extra}
          </p>
        )}
      </div>
    </section>
  );
}
