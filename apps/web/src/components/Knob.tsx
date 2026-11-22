import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { clamp, stepValue, valueFromDrag } from '@pro-studio/shared';

interface KnobProps {
  /** Accessible name, e.g. "Kick volume". */
  label: string;
  value: number;
  min: number;
  max: number;
  /** Keyboard step. Shift multiplies it by ten. */
  step: number;
  /** Double-click and Home reset to this. */
  defaultValue: number;
  onChange: (value: number) => void;
  /** Text for the value, used by screen readers and the tooltip. */
  format: (value: number) => string;
  /** Arc grows from the middle (pan) instead of the left. */
  bipolar?: boolean;
  /** A CSS colour value, normally a channel token such as var(--ch-3). */
  color?: string;
  size?: 'sm' | 'md';
}

const START = -135;
const END = 135;
const R = 13;
const C = 16;

function point(angle: number): [number, number] {
  const a = ((angle - 90) * Math.PI) / 180;
  return [C + R * Math.cos(a), C + R * Math.sin(a)];
}

function arc(from: number, to: number): string {
  if (Math.abs(to - from) < 0.5) return '';
  const [x0, y0] = point(from);
  const [x1, y1] = point(to);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 ${Math.abs(to - from) > 180 ? 1 : 0} ${to > from ? 1 : 0} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export function Knob({ label, value, min, max, step, defaultValue, onChange, format, bipolar = false, color, size = 'md' }: KnobProps) {
  const drag = useRef<{ y: number; start: number } | null>(null);
  const [active, setActive] = useState(false);
  const norm = clamp((value - min) / (max - min), 0, 1);
  const angle = START + norm * (END - START);
  const from = bipolar ? 0 : START;
  const text = format(value);

  const down = (e: PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus();
    drag.current = { y: e.clientY, start: value };
    setActive(true);
  };
  const move = (e: PointerEvent<HTMLDivElement>): void => {
    if (!drag.current) return;
    onChange(valueFromDrag(drag.current.start, drag.current.y - e.clientY, { min, max }, 160, e.shiftKey));
  };
  const up = (): void => {
    drag.current = null;
    setActive(false);
  };
  const key = (e: KeyboardEvent<HTMLDivElement>): void => {
    const big = e.shiftKey ? 10 : 1;
    let next: number | null = null;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') next = stepValue(value, big, step, { min, max });
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') next = stepValue(value, -big, step, { min, max });
    else if (e.key === 'PageUp') next = stepValue(value, 10, step, { min, max });
    else if (e.key === 'PageDown') next = stepValue(value, -10, step, { min, max });
    else if (e.key === 'Home') next = defaultValue;
    else if (e.key === 'End') next = max;
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    onChange(next);
  };

  return (
    <div
      className="knob"
      data-size={size}
      data-active={active || undefined}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Number(value.toFixed(3))}
      aria-valuetext={text}
      title={`${label}: ${text}`}
      style={color ? ({ '--knob-color': color } as React.CSSProperties) : undefined}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onDoubleClick={() => onChange(defaultValue)}
      onKeyDown={key}
    >
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path className="knob-track" d={arc(START, END)} />
        <path className="knob-value" d={arc(from, angle)} />
        <circle className="knob-cap" cx={C} cy={C} r="8.5" />
        <line className="knob-tick" x1={C} y1={C} x2={point(angle)[0] * 0.55 + C * 0.45} y2={point(angle)[1] * 0.55 + C * 0.45} />
      </svg>
    </div>
  );
}
