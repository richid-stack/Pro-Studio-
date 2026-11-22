import { useEffect, useRef } from 'react';
import { MAX_RATCHET, setRatchet, setRollShape, setStepVelocity, toggleStep, type DrumChannel, type RollShape } from '@pro-studio/shared';
import { Icon } from '../../components/Icon';
import { studio } from '../../state/studio';

export interface StepEditorTarget {
  channelId: string;
  step: number;
  /** Where the step is on screen, so the popover can sit next to it. */
  rect: { left: number; top: number; bottom: number };
}

const SHAPES: ReadonlyArray<[RollShape, string]> = [['flat', 'Even'], ['up', 'Rising'], ['down', 'Falling'], ['updown', 'Rise and fall']];

interface Props {
  target: StepEditorTarget;
  channel: DrumChannel;
  onClose: () => void;
}

/** Velocity, ratchet and roll shape for one step. Opens from a right-click, a double-click or the context-menu key. */
export function StepEditor({ target, channel, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { step } = target;
  const velocity = channel.v[step] ?? 0;
  const ratchet = channel.r[step] ?? 1;
  const on = velocity > 0;

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input, button')?.focus();
    const away = (e: PointerEvent): void => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [onClose]);

  const left = Math.min(target.rect.left, window.innerWidth - 240);
  const top = Math.min(target.rect.bottom + 4, window.innerHeight - 260);
  const edit = (fn: Parameters<typeof studio.edit>[0], key?: string): void => studio.edit(fn, key ? { key } : undefined);

  return (
    // Escape closes the editor; every control inside it is natively focusable.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={ref}
      className="step-editor"
      role="dialog"
      aria-label={`${channel.name}, step ${step + 1}`}
      style={{ left, top }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="step-editor-head">
        <strong>{channel.name}, step {step + 1}</strong>
        <button type="button" className="icon-btn" aria-label="Close step editor" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <label className="field">
        <span>Velocity {Math.round(velocity * 100)}%</span>
        <input
          type="range"
          className="range"
          min={5}
          max={100}
          value={Math.max(5, Math.round(velocity * 100))}
          onChange={(e) => edit((p) => setStepVelocity(p, channel.id, step, Number(e.target.value) / 100), `stepvel:${channel.id}:${step}`)}
        />
      </label>
      <div className="field">
        <span>Ratchet, {ratchet === 1 ? 'one hit' : `${ratchet} hits in the step`}</span>
        <div className="stepper">
          <button type="button" className="icon-btn" aria-label="Fewer hits" disabled={ratchet <= 1} onClick={() => edit((p) => setRatchet(p, channel.id, step, ratchet - 1))}>
            <Icon name="minus" />
          </button>
          <span className="readout-sm" aria-hidden="true">{ratchet}</span>
          <button type="button" className="icon-btn" aria-label="More hits" disabled={ratchet >= MAX_RATCHET} onClick={() => edit((p) => setRatchet(p, channel.id, step, ratchet + 1))}>
            <Icon name="plus" />
          </button>
        </div>
      </div>
      {ratchet > 1 && (
        <label className="field">
          <span>Roll shape (every roll on this channel)</span>
          <select className="select" value={channel.roll} onChange={(e) => edit((p) => setRollShape(p, channel.id, e.target.value as RollShape))}>
            {SHAPES.map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </label>
      )}
      <div className="step-editor-actions">
        <button type="button" className="btn" onClick={() => { edit((p) => (on ? toggleStep(p, channel.id, step) : p)); onClose(); }} disabled={!on}>
          Clear step
        </button>
      </div>
    </div>
  );
}
