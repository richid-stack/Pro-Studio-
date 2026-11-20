# Pro Studio

A browser-first beatmaking studio for **trap, drill, R&B and Afrobeat**, built to be a real product (web first, desktop later) and to give a first-time producer the tools to make an industry-level beat while giving experienced producers more control than the mainstream DAWs.

## Status

Early. What works today, and is tested:

- **Laptop-keyboard piano** with real sound (three presets), an on-screen keyboard you can also click or tap, chord naming, two key layouts, octave and velocity control.
- **Three experience modes**: Beginner (guided, lots of help), Standard (the full studio, for everyone), Pro (every technical control). Switching never changes your project data.
- **Design system**: tokens, dark and light themes, compact and roomy density, WCAG 2.2 AA contrast enforced in CI.
- **Music theory and audio analysis packages**: 13 scales, chord building and detection, genre progressions, onset detection, pitch detection, loop finding.

What is next (see [docs/ROADMAP.md](docs/ROADMAP.md)): the dockable, maximizable workspace; the pro piano roll; the sound browser with drag and drop; then the audio engine, playlist, producer-assist tools, backend and desktop app.

`prototype/` holds the earlier single-file prototype (drum machine, 808, sampler). It is kept for reference and is not part of the build.

## Quick start

Requires Node 22+ and pnpm 9.

```bash
pnpm install       # the first install creates pnpm-lock.yaml: commit it
pnpm dev           # http://localhost:5173
```

Press `A S D F G H J K` for notes, `W E T Y U` for black keys, `Z` / `X` for octave, `C` / `V` for velocity.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start the web app |
| `pnpm build` | Typecheck and build every package |
| `pnpm typecheck` | TypeScript strict check, all packages |
| `pnpm test` | Unit tests (`node:test`) for shared, engine and ui |
| `pnpm e2e` | Playwright browser tests (needs `pnpm exec playwright install chromium` once) |
| `pnpm contrast` | WCAG contrast gate for the design tokens, both themes |
| `pnpm lint` / `pnpm format` | ESLint and Prettier |

## Repository layout

```
apps/web         React + Vite client
packages/shared  Music theory, typing-keyboard piano, experience modes, project schema (no DOM)
packages/engine  Audio analysis today; the AudioWorklet engine arrives in Phase 2
packages/ui      Design tokens, themes, contrast gate; components arrive in Phase 1
prototype/       Earlier single-file prototype, reference only
docs/            Architecture, roadmap, design system, sound library, standards
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how it is built and why
- [docs/ROADMAP.md](docs/ROADMAP.md): phases with exit criteria
- [docs/BEYOND-FL.md](docs/BEYOND-FL.md): the producer-assist features
- [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md): identity, tokens, accessibility rules
- [docs/SOUND-LIBRARY.md](docs/SOUND-LIBRARY.md): what sounds may ship and how they are tracked
- [docs/FRONTEND_ENGINEERING_STANDARD.md](docs/FRONTEND_ENGINEERING_STANDARD.md): the quality bar for all UI work
- [CLAUDE.md](CLAUDE.md): instructions for AI coding agents working in this repo

## Licence

Not yet chosen. Decide before the first public release; until then all rights are reserved by the owner. Sounds and third-party libraries carry their own licences and are tracked per `docs/SOUND-LIBRARY.md`.
