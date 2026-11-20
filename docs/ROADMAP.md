# Roadmap

Each phase has exit criteria. A phase is done when every criterion is demonstrably true, not when the code is merged. "Verified" means tested by an automated test or inspected in a real browser, as stated.

## Phase 0: Foundation  (in progress)

Repo, standards, design tokens, the logic that must be correct before UI is built on it.

- [x] pnpm monorepo, strict TypeScript, ESLint, Prettier, CI workflow
- [x] `@pro-studio/shared`: theory (13 scales, 13+ chord types, chord detection, genre progressions), typing-keyboard piano state machine, project schema v1. 22 tests.
- [x] `@pro-studio/engine/analysis`: onset detection, YIN pitch, loop finder. 9 tests.
- [x] `@pro-studio/ui`: tokens, dark and light themes, density modes, contrast gate (WCAG 2.2 AA, 198 pairs)
- [x] Docs and the frontend standard in the repo
- [x] `packages/shared`: experience-mode registry (Beginner / Standard / Pro) with tests; typing-keyboard input controller. 52 unit tests in total (41 shared, 9 engine, 2 ui)
- [x] `apps/web` shell: keyboard piano with sound presets, on-screen keys, mode / theme / density switchers. Verified in Chromium by 13 Playwright tests against an esbuild bundle (sound is measured, not assumed)
- [ ] Same shell verified under Vite, with `tsc` against the real `@types/react`, ESLint and axe-core (**needs a networked `pnpm install`; CI does this on the first push**)
- Exit: `pnpm install && pnpm dev` opens the shell, pressing `A S D F...` plays notes, CI is green on `main`.

## Phase 1: Workspace, piano roll, sound browser

The first milestone you asked for.

- Docking workspace: resizable, scrollable, maximizable panels; saved layouts; focus mode.
- Pro piano roll (canvas): draw / select / slice / erase tools, marquee, multi-select, drag, edge-resize, snap grid with triplets and swing, velocity lane, scale highlight with snap-to-scale, ghost notes from other channels, chord stamp, strum and humanize, zoom on both axes with the wheel and keyboard, keyboard-played notes with record.
- Laptop keyboard plays the focused instrument everywhere, with on-screen octave and velocity indicator and a visible "keys active" state. Two layouts.
- Sound browser: folders, tags, search, favorites, waveform preview on hover, drag onto a channel / the roll / the playlist, key and BPM detection shown per sample.
- Undo/redo as patches. Autosave to IndexedDB. Command palette. Shortcut map.
- **Mode switcher (Beginner / Standard / Pro)** wired through the whole workspace from the first panel: every panel and control declares its mode in the feature registry; Pro-only data shows as a summary in lower modes.
- Exit (verified in Playwright): switching modes changes what is visible without changing the project; play 12 notes from the keyboard with sound; draw, move, resize and delete notes with the mouse; maximize and restore the roll; drag a sample from the browser onto a channel and hear it; reload and find the project intact; axe passes; 4 viewport screenshots reviewed.

## Phase 2: Engine v2

- Worklet engine with sample-accurate transport, voices, mixer, sends, insert chain, master limiter and meters.
- Channel and mixer inserts: EQ, compressor, saturation, reverb, delay, filter, transient shaper, sidechain.
- Sampler v2: slicing, key-zones, loop with crossfade, time-stretch and pitch.
- Export: WAV (16/24-bit), MP3, stems; loudness readout (LUFS, true peak).
- `.prostudio` project file.
- Exit: offline render of a fixture project matches golden loudness and spectrum; 64 simultaneous voices without dropouts on a mid-range laptop (measured); keyboard-to-sound latency recorded.

## Phase 3: Arrangement

- Playlist (canvas): audio and pattern clips, automation lanes, markers, loop regions, ripple edit.
- Song-section builder: intro, verse, hook, bridge, drop with genre-aware lengths and transitions (risers, drum fills, 808 slides).
- Exit: a 3-minute arrangement of 12 channels plays and exports without glitches; edit-undo round-trips.

## Phase 4: Producer assist (the "beyond FL" core)

See `docs/BEYOND-FL.md`. Order of delivery chosen by value for someone who cannot yet make a beat:

1. Vibe Starter (genre and mood to a full loop, 8 variations, lockable layers) and the **Beginner guided builder** that wraps it: pick a vibe, build drums, 808, chords and melody one step at a time with plain-language explanations, then "Open in the full studio"
2. Harmony guide, chord brain, melody coach
3. Hi-hat designer, 808 Doctor
4. Groove cloner
5. Mix health check, mix assistant
- Exit: someone who has never produced can reach an exported, loudness-checked beat in under 15 minutes (user test with at least 5 people, recorded).

## Phase 5: Backend and accounts

- Accounts, project sync with version history, cloud sample storage, share links, export hub.
- Exit: create a project on one device, open it on another, see the version history, restore a version.

## Phase 6: Audio intelligence and collaboration

- Hum / tap / beatbox to MIDI and drums.
- Stem separation and the sample flip lab; clearance and split-sheet helper (informational, not legal advice).
- Reference match and the masking map.
- AI vocal-chop and instrument maker.
- Realtime collaboration (presence, per-channel CRDT).
- Exit: each feature has a measured quality bar (e.g. onset-to-drum accuracy on a labelled set) and a human-in-the-loop fallback.

## Phase 7: Desktop, performance, mobile

- Tauri build with native file access and low-latency audio device selection.
- Performance mode (pads, scenes, clip launching) and phone mode.
- Learn mode (guided lessons that drive the real UI).
- Exit: signed installers for macOS and Windows; touch layout passes the comfortable-density 44 px target audit.

## Phase 8: Launch hardening

- Sound library licensing audit and credits page, privacy policy, terms.
- Accessibility audit with assistive technology, performance budgets enforced in CI, crash reporting, telemetry opt-in.
- Exit: independent review of licensing and accessibility with no open critical findings.
