# Instructions for AI coding agents

Read before changing anything: `docs/FRONTEND_ENGINEERING_STANDARD.md` (the quality bar), `docs/ARCHITECTURE.md` (how it fits together), `docs/DESIGN-SYSTEM.md` (tokens and accessibility rules). If the work changes a decision, update the doc in the same change.

## Product

A browser-first beatmaking studio for trap, drill, R&B and Afrobeat. Those genres are not negotiable. It must serve three kinds of user through one codebase: Beginner (lots of help), Standard (everyone), Pro (every technical control).

## Commands

```bash
pnpm install        # first run creates pnpm-lock.yaml; commit it
pnpm typecheck      # strict TS, all packages
pnpm test           # node:test unit tests (shared, engine, ui)
pnpm e2e            # Playwright (apps/web)
pnpm contrast       # WCAG gate over the design tokens: run after any colour change
pnpm lint
```

## Rules

1. **Strict TypeScript.** `verbatimModuleSyntax` is on: use `import type` for types. No `any` without a comment saying why.
2. **Logic goes in packages, not components.** Anything that can run without a DOM (theory, input handling, analysis, mode rules) lives in `packages/*` with `node:test` tests. Components stay thin.
3. **Tokens only.** No hex colours, pixel sizes or radii in components or app CSS: use the semantic tokens in `packages/ui/src/styles/tokens.css`. New colour that carries meaning gets a token and a pair in `packages/ui/scripts/check-contrast.mjs`. Both themes.
4. **Modes.** Every user-facing feature is registered in `packages/shared/src/modes.ts` with the mode it belongs to, and the UI asks `isFeatureVisible(id, mode)`. A mode changes what is shown and the defaults, never the project data. Do not fork components per mode.
5. **No fake controls.** If a control exists it works. Planned things live in `docs/ROADMAP.md`, not as dead buttons. If something is a prototype or stub, label it so in the UI and the code.
6. **Audio never waits for the UI.** Sound is produced on the audio side; the UI sends commands. Do not put timing-critical work in React render paths.
7. **Keyboard first.** Every command is reachable by keyboard. Typing in a text field must never trigger the piano or a shortcut (see `isEditableTarget`). Every icon-only control has an accessible name.
8. **Sounds.** Only CC0, our own, or licensed-for-redistribution sounds, each with a manifest entry. Never add a sound you cannot show the licence for. See `docs/SOUND-LIBRARY.md`.
9. **Do not import from `prototype/`.** It is reference material.
10. **Dependencies.** Add one only for a real requirement and say why in the PR. No second library for a job one already does.

## Verifying UI work

Do not call a screen done from reading code. Run it, drive it with Playwright, capture screenshots at 390, 768, 1280 and 1920 px in dark and light, check the console and network, check keyboard-only use, and fix root causes (not magic numbers). Say plainly what you could not verify.

## Commits

Small, focused, imperative subject lines. Tests and docs in the same commit as the behaviour they cover.
