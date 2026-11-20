# Copilot instructions

Pro Studio is a browser-first beatmaking studio (trap, drill, R&B, Afrobeat) in a pnpm monorepo with strict TypeScript. The authoritative rules are in [CLAUDE.md](../CLAUDE.md); read them before reviewing or suggesting code. Path-specific guidance is in `.github/instructions/`.

When reviewing, prioritise:

1. Audio-thread safety: code that runs per audio block must not allocate, lock, log or throw, and must not let NaN or Infinity reach the output.
2. Audio never waits for the UI: no timing-critical work on a React render path.
3. Tokens only: no hex colours, raw px sizes or radii in components or app CSS.
4. Mode registry: user-facing features are registered in `packages/shared/src/modes.ts` and gated with `isFeatureVisible`. Modes change what is shown, never project data.
5. No fake controls: every control works, or is clearly labelled as a stub.
6. Keyboard first: typing in a text field must not trigger the piano or shortcuts; icon-only controls have accessible names.
7. Sounds need a manifest entry with a licence.
8. Dependency direction: `shared` imports nothing; `engine` imports only `shared`; nothing imports `prototype/`.
9. Server code authorizes on the server and scopes every query to the owner.
10. New logic has tests.

Do not comment on formatting (Prettier), the lockfile, or `prototype/`.
