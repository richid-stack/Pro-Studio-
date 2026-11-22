import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { clamp, splitterStep } from '@pro-studio/shared';

interface SplitterProps {
  /** A vertical splitter sits between side-by-side panels and drags left and right. */
  orientation: 'vertical' | 'horizontal';
  label: string;
  value: number;
  min: number;
  max: number;
  /** True when growing the value means moving toward the start (a panel on the far side, such as the mixer below). */
  invert?: boolean;
  onChange: (value: number) => void;
}

export function Splitter({ orientation, label, value, min, max, invert = false, onChange }: SplitterProps) {
  const start = useRef<{ at: number; value: number } | null>(null);
  const horizontal = orientation === 'horizontal';
  const sign = invert ? -1 : 1;

  const down = (e: PointerEvent<HTMLDivElement>): void => {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { at: horizontal ? e.clientY : e.clientX, value };
  };
  const move = (e: PointerEvent<HTMLDivElement>): void => {
    const s = start.current;
    if (!s) return;
    const delta = ((horizontal ? e.clientY : e.clientX) - s.at) * sign;
    onChange(clamp(s.value + delta, min, max));
  };
  const up = (): void => {
    start.current = null;
  };
  const key = (e: KeyboardEvent<HTMLDivElement>): void => {
    const grow = horizontal ? (invert ? 'ArrowUp' : 'ArrowDown') : invert ? 'ArrowLeft' : 'ArrowRight';
    const shrink = horizontal ? (invert ? 'ArrowDown' : 'ArrowUp') : invert ? 'ArrowRight' : 'ArrowLeft';
    let next: number | null = null;
    if (e.key === grow) next = value + splitterStep(e.shiftKey);
    else if (e.key === shrink) next = value - splitterStep(e.shiftKey);
    else if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    if (next === null) return;
    e.preventDefault();
    onChange(clamp(next, min, max));
  };

  return (
    // A focusable separator is the WAI-ARIA "window splitter" pattern: arrow keys resize, so it is an interactive widget.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="splitter"
      data-orientation={orientation}
      role="separator"
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      aria-orientation={horizontal ? 'horizontal' : 'vertical'}
      aria-label={label}
      aria-valuemin={Math.round(min)}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(value)}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
    />
  );
}
