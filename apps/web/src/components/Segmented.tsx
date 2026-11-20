/**
 * Segmented single-choice control built on native radio inputs, so arrow keys, focus and screen-reader
 * semantics come from the browser. Moves into @forge/ui in Phase 1 when the component library starts.
 */
interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

interface SegmentedProps<T extends string> {
  /** Accessible group name, also the radio `name`. */
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <fieldset className="segmented">
      <legend className="visually-hidden">{label}</legend>
      {options.map((o) => (
        <label key={o.value} className="segmented-option" title={o.hint}>
          <input
            type="radio"
            className="visually-hidden"
            name={label}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
