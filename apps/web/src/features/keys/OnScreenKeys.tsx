import type { CSSProperties } from 'react';
import { keyLabel, midiName } from '@pro-studio/shared';

const WHITE_PCS = new Set([0, 2, 4, 5, 7, 9, 11]);

interface OnScreenKeysProps {
  baseMidi: number;
  /** Number of semitones above baseMidi that are shown (inclusive). */
  span: number;
  held: ReadonlySet<number>;
  /** Typing-key codes by semitone offset, so each key shows the letter that plays it. */
  codesByOffset: ReadonlyMap<number, readonly string[]>;
  onPress: (note: number, pointerId: number) => void;
  onRelease: (pointerId: number) => void;
}

export function OnScreenKeys({ baseMidi, span, held, codesByOffset, onPress, onRelease }: OnScreenKeysProps) {
  const notes = Array.from({ length: span + 1 }, (_, i) => baseMidi + i);
  const whites = notes.filter((n) => WHITE_PCS.has(n % 12));
  const whiteWidth = 100 / whites.length;
  const blackWidth = whiteWidth * 0.62;

  const renderKey = (n: number, black: boolean, style?: CSSProperties) => {
    const codes = codesByOffset.get(n - baseMidi) ?? [];
    const pressed = held.has(n);
    return (
      <button
        key={n}
        type="button"
        tabIndex={-1}
        className={black ? 'key key-black' : 'key key-white'}
        style={style}
        aria-label={midiName(n)}
        aria-pressed={pressed}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          onPress(n, e.pointerId);
        }}
        onPointerUp={(e) => onRelease(e.pointerId)}
        onPointerCancel={(e) => onRelease(e.pointerId)}
      >
        {n % 12 === 0 && <span className="key-note">{midiName(n)}</span>}
        {codes.map((c) => (
          <span key={c} className="key-cap">
            {keyLabel(c)}
          </span>
        ))}
      </button>
    );
  };

  return (
    <div className="piano" role="group" aria-label="On-screen piano">
      <div className="piano-whites">{whites.map((n) => renderKey(n, false))}</div>
      {notes
        .filter((n) => !WHITE_PCS.has(n % 12))
        .map((n) => {
          const whiteIndex = whites.filter((w) => w < n).length;
          return renderKey(n, true, { left: `${whiteIndex * whiteWidth - blackWidth / 2}%`, width: `${blackWidth}%` });
        })}
    </div>
  );
}
