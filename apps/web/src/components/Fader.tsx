import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { FADER_MAX_DB, FADER_MIN_DB, clamp, dbToFader, faderToDb, formatDb, speakDb } from '@pro-studio/shared';

interface FaderProps {
  label: string;
  db: number;
  onChange: (db: number) => void;
  /** Double-click resets to this. Defaults to unity (0 dB). */
  defaultDb?: number;
  color?: string;
}

/** A vertical level fader. Position is nonlinear (more room near unity), so dragging works on position and the value follows. */
export function Fader({ label, db, onChange, defaultDb = 0, color }: FaderProps) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; pos: number } | null>(null);
  const pos = dbToFader(db);

  const down = (e: PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus();
    drag.current = { y: e.clientY, pos };
  };
  const move = (e: PointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    const h = track.current?.clientHeight;
    if (!d || !h) return;
    const dy = (d.y - e.clientY) / h / (e.shiftKey ? 8 : 1);
    onChange(faderToDb(clamp(d.pos + dy, 0, 1)));
  };
  const up = (): void => {
    drag.current = null;
  };
  const key = (e: KeyboardEvent<HTMLDivElement>): void => {
    const big = e.shiftKey ? 6 : 1;
    let next: number | null = null;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') next = db + 0.5 * big;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') next = db - 0.5 * big;
    else if (e.key === 'PageUp') next = db + 6;
    else if (e.key === 'PageDown') next = db - 6;
    else if (e.key === 'Home') next = defaultDb;
    else if (e.key === 'End') next = FADER_MAX_DB;
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    onChange(clamp(next, FADER_MIN_DB, FADER_MAX_DB));
  };

  return (
    <div
      className="fader"
      role="slider"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={FADER_MIN_DB}
      aria-valuemax={FADER_MAX_DB}
      aria-valuenow={Number(db.toFixed(1))}
      aria-valuetext={speakDb(db)}
      title={`${label}: ${formatDb(db)}`}
      style={color ? ({ '--fader-color': color } as React.CSSProperties) : undefined}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onDoubleClick={() => onChange(defaultDb)}
      onKeyDown={key}
    >
      <div className="fader-track" ref={track}>
        <div className="fader-fill" style={{ '--pos': pos } as React.CSSProperties} />
        <div className="fader-unity" />
        <div className="fader-cap" style={{ '--pos': pos } as React.CSSProperties} />
      </div>
    </div>
  );
}
