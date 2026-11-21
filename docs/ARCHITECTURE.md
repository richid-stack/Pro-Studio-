# Architecture

Pro Studio is a browser-first beatmaking workstation (trap, drill, R&B, Afrobeat) that is built to ship as a product and to be wrapped in a desktop shell later. This document is the source of truth for how it is put together. Change it in the same PR as the code it describes.

Status legend: **built** = in the repo and tested, **planned** = decided but not written.

## 1. Principles

1. **The document is the product.** A project is plain JSON (`@pro-studio/shared` `Project`, schema-versioned). The UI, the audio engine, undo/redo, autosave, sync and export all read and write that one model. No state lives only in a DOM node or an audio node.
2. **Audio never waits for the UI.** Sound is produced on the audio thread (AudioWorklet). The UI thread sends commands and receives meters and playhead positions. A slow React render must never cause a glitch.
3. **Pure logic is a package with tests, not code inside a component.** Music theory, keyboard mapping and sample analysis already live in packages and run under `node:test` with no browser.
4. **Local-first.** Everything works offline and saves to the device. The cloud adds sync, sharing and AI; it is never required to make a beat.
5. **Built for the keyboard and the mouse.** Every command has a name, a shortcut and a command-palette entry. Pointer editing is canvas-based so it stays fast at thousands of notes.
6. **No fake controls.** A control exists when it works. Roadmap items live in `docs/ROADMAP.md`, not as dead buttons in the UI.

## 2. Repository layout

```
apps/
  web/            React + Vite client (planned: Phase 0 shell is in the repo)
  desktop/        Tauri wrapper around apps/web (planned, Phase 7)
  api/            Node + TypeScript API (planned, Phase 5)
packages/
  shared/         Pure TS, no DOM: theory, typing-keyboard piano, project schema (built, 22 tests)
  engine/         Audio and analysis: onset detection, YIN pitch, loop finder (built, 9 tests);
                  worklet DSP and scheduler (planned, Phase 2)
  ui/             Design tokens, themes, contrast gate, then components (tokens built; components planned)
  dsp-wasm/       Rust to WASM DSP kernels, once profiling shows a JS kernel is too slow (planned)
prototype/        The single-file artifact prototype, kept as a reference for sound design and UX.
                  Not part of the build. Do not import from it.
docs/             This folder.
```

Dependency direction is one way: `apps/*` -> `@pro-studio/ui`, `@pro-studio/engine` -> `@pro-studio/shared`. `@pro-studio/shared` imports nothing. CI should fail a PR that adds a reverse import.

Packages resolve through `tsconfig.base.json` `paths` to `src/index.ts`, so there is no build step between packages in development and typechecking works without installing anything.

## 3. Runtime architecture (planned for Phase 1-2)

```
            UI thread (React)                                  Audio thread
  ┌─────────────────────────────────────┐             ┌──────────────────────────────┐
  │ Canvas views (roll, playlist)       │             │ AudioWorklet "pro-studio-engine"   │
  │ React panels (browser, mixer, ...)  │  commands   │  - transport + sample clock   │
  │ Project store  ──patches──► Engine  ├────────────►│  - voices (drums, 808, synth, │
  │ client (typed message protocol)     │  SAB ring   │    sampler)                   │
  │                                     │◄────────────┤  - mixer + insert chain       │
  │ meters, playhead, voice activity    │  telemetry  │  - master limiter, meters     │
  └─────────────────────────────────────┘             └──────────────────────────────┘
```

- **Project store.** One store owns the `Project`. Edits are expressed as small patches (add note, move notes, set param). Undo/redo is a patch stack, so a drag that moves 40 notes is one undo step. The store is the only writer; panels subscribe to the slices they draw.
- **Engine protocol.** The engine client sends typed commands (`play`, `seek`, `setTempo`, `noteOn`, `noteOff`, `setParam`, `loadSample`, `applyPatch`). Audio data (decoded samples) is transferred, not copied. Playhead and meters come back through a lock-free ring buffer (SharedArrayBuffer when cross-origin isolation is available, `postMessage` fallback otherwise).
- **Scheduling.** Sequencing happens inside the worklet against the sample clock, so timing is sample-accurate and independent of main-thread load. The prototype's lookahead scheduler on a Worker ticker is the fallback path and the reference implementation.
- **Live input.** Laptop-keyboard and MIDI input go straight to `noteOn` on the engine, bypassing the project store, so latency is one message hop. If recording is armed, the same events are also timestamped against the transport clock and written to the store as notes on stop-or-quantize.
- **DSP.** Start in TypeScript inside the worklet. Move a kernel to Rust/WASM only when a profile shows a real cost (candidates: convolution reverb, pitch-shift, time-stretch, stem separation inference).
- **Offline render.** Export uses the same engine in `OfflineAudioContext`, driven by the same project document. A golden-file test renders a fixed project and compares loudness and spectral fingerprints so an engine change cannot silently alter the sound.

## 4. Rendering

- The piano roll, step grid and playlist are **canvas** (2D first, WebGL if profiling needs it). DOM per note does not scale; a roll with 4,000 notes at 60 fps is a requirement.
- Draw only the visible window (virtualized by time and pitch). Redraw on demand: when the store changes, the view scrolls or zooms, or the playhead moves. No idle redraw loop.
- Hit-testing is done in model space (time, pitch) from pointer coordinates, not by reading pixels. That is what makes marquee select, edge-resize, velocity lane editing and snapping testable without a browser.
- Canvas content is not accessible by default, so every canvas view has a parallel accessible model: a focusable grid with arrow-key navigation, announced note names and a note list, so the roll is usable with a keyboard and screen reader.
- Panels are React and DOM. They use `@pro-studio/ui` components and tokens only.

## 5. Workspace (Phase 1)

Panels (Browser, Channel rack, Piano roll, Playlist, Mixer, Inspector) live in a docking layout:

- Resizable splitters with persisted sizes, scrollable bodies, minimum sizes that keep controls usable.
- Every panel can be **maximized** (double-click the header or `Shift+F`) and restored. The piano roll additionally has a focus mode that hides everything but transport and the roll.
- Panels can be detached into floating windows and tabbed together. Layout is saved per project and as named presets (Beat, Mix, Arrange, Performance).
- Below the tablet breakpoint the layout becomes one panel at a time with bottom navigation; it is designed, not shrunk.

## 5b. Experience modes: Beginner, Standard, Pro

One engine and one project format, three levels of interface. Implemented as a registry in `@pro-studio/shared` (`modes.ts`, tested) that the UI queries with `isFeatureVisible(id, mode)`.

| Mode | For | What changes |
| --- | --- | --- |
| **Beginner** | Never made a beat | The core workshop is always there (channel rack, piano roll, a simple mixer, starter beats, export) because a beginner who cannot see the step grid cannot make a beat. On top of it: coach marks, plain-language labels, "explain why" on every suggestion, safety rails on (scale snap, loudness guard, confirm before destructive actions), comfortable density. Per-step velocity and ratchets, the velocity lane, sends and the playlist reveal from Standard. The guided beat builder and Vibe Starter will sit on top when built; until then the rack is the way in. |
| **Standard** | Everyone | The full workspace: channel rack, piano roll, playlist, mixer, sound browser, docking and maximize. Assist tools on demand. Compact density. |
| **Pro** | Producers and engineers | Everything in Standard plus per-note properties, arbitrary routing and sidechain matrix, automation curves, tempo map, spectrum/phase/loudness analysis, MIDI CC, custom shortcuts and macros, numeric readouts. Safety rails off by default. |

Rules:

1. **A mode changes what is shown and the defaults, never the data.** The project has no mode. A note with pan automation made in Pro opens in Beginner as a summary ("open in Pro to edit"), not as a stripped copy. Switching is instant, lossless and reversible.
2. **Tools reveal upward, guidance fades upward.** `from` gates tools (Pro tools do not clutter Beginner); `until` gates guidance (Pro users are not nagged by coach marks). A test asserts nothing a Beginner can use disappears in Pro. Guidance can be forced on or off in settings.
3. **The mode is a user preference** (local first, account later), with the default density and safety rails attached to it (`MODE_DEFAULTS`). The user can override density and every rail separately.
4. **No per-mode forks of components.** A component reads the registry and renders more or less; it is not rewritten per mode.
5. **Every new feature declares its mode in the registry in the same PR.** CI fails if a registered feature id is not used by the UI and vice versa (added with the first feature panels).

## 6. Data and persistence

| Layer | Technology | Phase |
| --- | --- | --- |
| Working copy and autosave | IndexedDB / OPFS, every change debounced, crash-safe | 1 |
| Project file | `.prostudio` = zip of `project.json` + referenced sample blobs | 2 |
| Sample library | OPFS blobs + IndexedDB metadata (tags, BPM, key, waveform peaks) | 1 |
| Cloud | Postgres for accounts, projects, versions, collaborators; S3-compatible object storage for samples, stems and renders | 5 |
| Sync | Per-project version history; last-writer-wins per project at first, then CRDT/OT per channel for realtime collaboration | 5-6 |

Schema changes bump `PROJECT_SCHEMA_VERSION` and ship a migration plus a fixture of the old format in `packages/shared/test/fixtures`. Loading never trusts the file: a validator (Zod) checks every field and reports what it dropped.

## 7. Backend (Phase 5, planned)

Node + TypeScript API, REST for resources and WebSocket for collaboration, Postgres for relational data, S3-compatible storage with presigned uploads. Auth with a standard provider (passwordless email plus OAuth), sessions in httpOnly cookies. All authorization decisions are made on the server; hiding a button is not authorization. Heavy work (stem separation, loudness analysis, rendering) runs in a job queue, not in a request.

AI features call a model service through the API with per-user rate limits and cost caps. Nothing the user uploads is used to train models without an explicit opt-in.

## 8. Frontend stack and the deliberate deviations from the standard

`docs/FRONTEND_ENGINEERING_STANDARD.md` is the default. Where this product differs, it is on purpose:

| Standard default | Pro Studio | Why |
| --- | --- | --- |
| Next.js | **Vite + React** | A DAW is a client-only, offline-capable app with no SEO or server rendering need. A marketing site can use Next separately. |
| Tailwind CSS | **Native CSS in cascade layers, driven by tokens** | Dense custom controls (knobs, faders, meters, docks) are mostly bespoke CSS. Tokens remain the single source of truth. |
| Standard button 40 px, input 40-44 px | **Compact density default (28 px), comfortable density (40 px)** | The standard calls these starting values. A DAW needs density; touch and accessibility users get the comfortable mode and a 44 px hit target. |
| TanStack Table | **Own canvas/virtualized grids** | Note and clip grids are not tables. TanStack Table is still right for admin and library views. |
| TanStack Query | Yes, from Phase 5 | Server state only. Project state is not server state. |
| Zustand | Yes, for the project store and UI state | Justified: shared, high-frequency state with selectors. |
| Radix / React Aria | Radix for dialogs, menus, tooltips, popovers; own components for canvas controls | |
| Lucide | Yes, behind one `<Icon>` wrapper | |
| Motion | Only for panel transitions and drag feedback | Reduced-motion respected. |

## 9. Quality gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm contrast`, `pnpm build` run in CI on every push (`.github/workflows/ci.yml`).
- Pure packages are tested with `node:test`. `apps/web` uses Vitest and Testing Library; Playwright covers workflows (play a note from the keyboard, drag a sample onto a channel, maximize the roll) and takes screenshots at 390, 768, 1280 and 1920 px wide for visual review.
- An axe-core pass runs in Playwright for each screen.
- Audio is tested offline: render, then assert on the samples (peak, RMS, spectral centroid, timing of onsets using the same detector shipped in the product).
- Budgets: initial JS under 250 kB gzipped before the audio engine loads, keyboard-to-sound latency measured and recorded, no main-thread task over 50 ms during playback.

## 10. Decision log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-11 | pnpm monorepo, strict TypeScript | Shared logic between web, desktop and API without publishing packages. |
| 2026-11 | Engine in AudioWorklet, DSP in TS first, WASM later | Correct timing without premature optimization. |
| 2026-11 | Canvas for roll and playlist | Note counts and zoom range rule out DOM. |
| 2026-11 | Local-first with optional cloud | Works offline and keeps the free tier cheap to run. |
| 2026-11 | Only CC0, own, or licensed sounds ship | See `docs/SOUND-LIBRARY.md`. |
