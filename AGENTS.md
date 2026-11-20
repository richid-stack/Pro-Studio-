# AGENTS.md

Pro Studio is a browser-first beatmaking studio (trap, drill, R&B, Afrobeat) in a pnpm monorepo. The rules for every coding agent live in [CLAUDE.md](CLAUDE.md): read it first. This file only adds what automated reviewers (Codex and others) need, and must never contradict it.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm test && pnpm contrast
pnpm check:deps && pnpm check:tokens && pnpm check:sounds
pnpm build && pnpm check:budget
pnpm e2e            # Playwright; needs `pnpm exec playwright install chromium` once
```

## Review guidelines

Report a finding only when it is a real defect, a rule violation from CLAUDE.md, or a missing test. Skip formatting (Prettier owns it), the lockfile, and `prototype/` (reference material, not built).

Treat these as high priority:

1. **Audio thread.** Code that runs per audio block (worklet `process`, DSP kernels in `packages/engine`) must not allocate, lock, log, touch the DOM, use `Date`, promises or timers, or throw. Buffers are preallocated. Flag NaN or Infinity that can reach the output, and any clipping path with no limiter.
2. **Audio never waits for the UI.** Timing-critical work in a React render, effect or event handler on the sound path is a bug.
3. **Dependency direction.** `@pro-studio/shared` imports nothing; `engine` imports only `shared`; `ui` imports no app code; packages never import `apps/*`; nothing imports `prototype/`.
4. **Tokens only.** No hex colours, raw px sizes or radii in components or app CSS; use `packages/ui/src/styles/tokens.css`. A new meaningful colour needs a token and a contrast pair in both themes.
5. **Modes.** A user-facing feature must be registered in `packages/shared/src/modes.ts` and gated with `isFeatureVisible`. A mode may change what is shown and the defaults, never project data. No per-mode component forks.
6. **No fake controls.** A control that does nothing, or a stub not labelled as one, is a defect.
7. **Keyboard first.** Typing in a text field must never trigger the piano or a shortcut (`isEditableTarget`). Icon-only controls need an accessible name. Every canvas view needs a keyboard and screen-reader path.
8. **Sounds.** A sound file needs a manifest entry with a licence (CC0, our own, or licensed for redistribution). A CC-BY sound needs attribution. Never accept a sound whose licence cannot be shown.
9. **Server code (`apps/api`).** Authorization is enforced on the server and every query is scoped to the owner. Validate input at the boundary. No secrets in code or logs. Tokens are stored hashed.
10. **Tests.** New logic in `packages/*` needs `node:test` tests. New user-visible behaviour needs a Playwright test or a stated reason it cannot have one. A change that alters a documented decision must update the doc in the same change.

Typing: strict TypeScript, `import type` for types, no `any` or `@ts-ignore` without a comment saying why.
