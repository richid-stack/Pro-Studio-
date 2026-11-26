const SLOTS = Array.from({ length: 10 }, (_, i) => i + 1);

/**
 * PREVIEW. The effect slots of the selected channel, laid out the way butterDAWg lays them out. Nothing here is
 * interactive and nothing is stored: effects arrive in Phase 2 (docs/ROADMAP.md). It exists so the layout is settled
 * before the engine can fill it, and it says so on screen.
 */
export function MixerInserts({ channelName }: { channelName: string | null }) {
  return (
    <aside className="inserts" aria-label="Effect slots, preview" data-preview="true">
      <div className="inserts-field">
        <span className="inserts-field-text">{channelName ?? 'No channel selected'}</span>
        <span className="inserts-badge">Preview</span>
      </div>
      <ol className="inserts-slots">
        {SLOTS.map((n) => (
          <li key={n} className="inserts-slot">
            <span className="inserts-caret" aria-hidden="true" />
            <span className="inserts-slot-name">Slot {n}</span>
            <span className="inserts-knob" aria-hidden="true" />
            <span className="inserts-lamp" aria-hidden="true" />
          </li>
        ))}
      </ol>
      <p className="inserts-note">Effects arrive with the Phase 2 engine. Until then the slots stay empty.</p>
      <div className="inserts-field">
        <span className="inserts-field-text">Out: Master</span>
      </div>
    </aside>
  );
}
