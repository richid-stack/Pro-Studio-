import { useState } from 'react';
import { isFeatureVisible } from '@pro-studio/shared';
import type { WavFormat } from '@pro-studio/engine';
import { Dialog } from '../../components/Dialog';
import { exportWav } from '../../state/files';
import { createStore, useStore } from '../../state/store';
import { usePreferences } from '../../state/usePreferences';

const open = createStore(false);
export const exportDialog = { open: (): void => open.set(true), close: (): void => open.set(false) };

type Kind = 'loop' | 'tail';

export function ExportDialog() {
  const isOpen = useStore(open, (o) => o);
  const { mode } = usePreferences();
  const [kind, setKind] = useState<Kind>('loop');
  const [format, setFormat] = useState<WavFormat>('pcm16');
  const [rate, setRate] = useState(44100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const technical = isFeatureVisible('numeric-readouts', mode);

  const run = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    const problem = await exportWav({ kind, format: technical ? format : 'pcm16', sampleRate: technical ? rate : 44100 });
    setBusy(false);
    if (problem) setError(problem);
    else exportDialog.close();
  };

  return (
    <Dialog
      open={isOpen}
      onClose={() => exportDialog.close()}
      title="Export audio"
      actions={
        <>
          <button type="button" className="btn" onClick={() => exportDialog.close()}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => void run()} disabled={busy}>
            {busy ? 'Exporting…' : 'Export WAV'}
          </button>
        </>
      }
    >
      <fieldset className="field-group">
        <legend>What to export</legend>
        <label className="choice">
          <input type="radio" name="export-kind" checked={kind === 'loop'} onChange={() => setKind('loop')} />
          <span>
            <strong>Seamless loop</strong>
            <span className="muted">Exactly one pass. Reverb and delay from the end already ring into the start, so it repeats without a click or a gap.</span>
          </span>
        </label>
        <label className="choice">
          <input type="radio" name="export-kind" checked={kind === 'tail'} onChange={() => setKind('tail')} />
          <span>
            <strong>One pass with the tail</strong>
            <span className="muted">Plays the beat once, then lets the reverb, delay and 808 ring out for three more seconds.</span>
          </span>
        </label>
      </fieldset>
      {technical && (
        <div className="field-row">
          <label className="field">
            <span>Bit depth</span>
            <select className="select" value={format} onChange={(e) => setFormat(e.target.value as WavFormat)}>
              <option value="pcm16">16-bit</option>
              <option value="pcm24">24-bit</option>
              <option value="float32">32-bit float</option>
            </select>
          </label>
          <label className="field">
            <span>Sample rate</span>
            <select className="select" value={rate} onChange={(e) => setRate(Number(e.target.value))}>
              <option value={44100}>44.1 kHz</option>
              <option value={48000}>48 kHz</option>
            </select>
          </label>
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </Dialog>
  );
}
