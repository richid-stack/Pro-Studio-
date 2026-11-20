## What and why

<!-- One or two sentences. Link the roadmap item or issue. -->

## How it was verified

<!-- Tests added or run, screenshots at 390 / 768 / 1280 / 1920 px in dark and light for UI work, and anything you could NOT verify. -->

## Checklist

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:scripts` pass
- [ ] `pnpm contrast`, `pnpm check:deps`, `pnpm check:tokens`, `pnpm check:sounds` pass
- [ ] New logic is in `packages/*` with `node:test` tests; new user-visible behaviour has a Playwright test
- [ ] New feature is registered in `packages/shared/src/modes.ts` and gated with `isFeatureVisible`
- [ ] No dead controls; keyboard path and accessible names exist
- [ ] Sounds added have a manifest entry with a licence
- [ ] A new dependency is justified below (CLAUDE.md rule 10), or none was added
- [ ] Docs updated if a decision changed (`docs/ARCHITECTURE.md`, `docs/ROADMAP.md`)

## Needs a real-device check?

<!-- e.g. iOS Safari audio unlock, Android battery saver, Bluetooth latency, USB MIDI. See docs/TESTING.md. -->
