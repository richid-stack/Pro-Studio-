import { useEffect, useState, type KeyboardEvent } from 'react';
import { clamp } from '@pro-studio/shared';

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Digits kept after the point when the value is shown and committed. */
  decimals?: number;
  /** Keep trailing zeros, so a tempo reads 130.00 and not 130. */
  fixed?: boolean;
  onCommit: (value: number) => void;
  className?: string;
}

const show = (v: number, decimals: number, fixed: boolean): string =>
  decimals === 0 ? String(Math.round(v)) : fixed ? v.toFixed(decimals) : v.toFixed(decimals).replace(/\.?0+$/, '');

/** A text field for a number. Type and press Enter, or use the arrow keys (Shift for ten times, Alt for a tenth). */
export function NumberField({ label, value, min, max, step, decimals = 0, fixed = false, onCommit, className }: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => setDraft(null), [value]);

  const commit = (text: string): void => {
    const n = Number.parseFloat(text.replace(',', '.'));
    setDraft(null);
    if (Number.isFinite(n)) onCommit(Number(clamp(n, min, max).toFixed(decimals)));
  };
  const key = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      commit(e.currentTarget.value);
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setDraft(null);
      e.currentTarget.blur();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const size = step * (e.shiftKey ? 10 : e.altKey ? 0.1 : 1);
      onCommit(Number(clamp(value + (e.key === 'ArrowUp' ? size : -size), min, max).toFixed(decimals + 1)));
    }
  };

  return (
    <input
      className={className ?? 'number-field'}
      type="text"
      inputMode="decimal"
      aria-label={label}
      value={draft ?? show(value, decimals, fixed)}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => draft !== null && commit(e.target.value)}
      onKeyDown={key}
    />
  );
}
