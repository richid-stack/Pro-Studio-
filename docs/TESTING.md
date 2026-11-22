# Testing

Goal: machines find the bugs; the owner only tests what machines cannot. Every layer below runs without a person except the last.

## The layers

| Layer | Catches | Runs | Command |
| --- | --- | --- | --- |
| Typecheck, ESLint (with React hooks and accessibility rules) | Type errors, bad patterns, missing labels | Local, CI | `pnpm typecheck`, `pnpm lint` |
| Unit tests (`node:test`) | Logic in `packages/*` (330 tests): theory, keyboard mapping, modes, roll gestures and keys, browser tree, engine DSP and timing, analysis | Local, CI | `pnpm test` |
| Repo-health checks | Broken architecture rules: dependency direction, hex/px literals, unlicensed sounds, bundle size | Local, CI | `pnpm check:deps`, `check:tokens`, `check:sounds`, `check:budget` (after build) |
| Repo-check tests | The checks themselves | Local, CI | `pnpm test:scripts` |
| Contrast gate | Any token pair under WCAG 2.2 AA, both themes | Local, CI | `pnpm contrast` |
| Browser e2e (Playwright) | The real app in a real browser (64 tests): keys and the browser panel make real sound, notes are drawn, moved and deleted with the mouse and the keyboard, modes switch, stars and layout survive a reload, no horizontal overflow at 390/768/1280/1920 px, no console errors or failed requests | Local (Chromium), CI (Chromium, Firefox, WebKit, Pixel 7, iPhone 14 emulation) | `pnpm e2e` |
| Static security (CodeQL, dependency review, secret scanning) | Vulnerable code and dependencies, leaked secrets | CI, GitHub | `.github/workflows/codeql.yml`, `dependency-review.yml` |
| AI reviewers | Rule violations and bugs a linter cannot see | On pull requests | See `docs/REVIEW-AND-CI.md` |
| Real devices | What no emulator reproduces (below) | The owner | Scripts below |

### Which project runs what

Chromium, Firefox and WebKit run every spec (WebKit has passed once on CI, so it now fails the build; Firefox stays experimental). The Pixel 7 and iPhone 14 projects run only `e2e/phone.spec.ts`: on a phone the workspace shows one panel at a time, so the desktop specs, which expect every panel on screen, do not apply. Tests that measure sound pass `audio: true` to `openApp`; they are skipped on headless Firefox, which reads silence from the audio tap on CI, and `L1b` below covers Firefox by hand. Drum hits are over in a few milliseconds, so those tests read the loudest sample since a reset (`resetHeard` and `heard`) instead of polling the instantaneous level.

### Running one spec or a built bundle

```bash
E2E_BASE_URL=http://127.0.0.1:4173/ pnpm --filter @pro-studio/web exec playwright test e2e/browser.spec.ts
```

The roll and browser specs set a 1280 by 800 viewport: at the default height the roll shows only a few pitch rows, and the tests pick notes that are on screen the way a person would.

Planned layers, added with the code they cover: offline audio-render tests (render a fixture project, assert on peak, RMS, frequency and onset timing), API tests with `fastify.inject`, axe-core accessibility passes, visual regression, and a measured latency and 64-voice stress test.

## Sound is measured, not assumed

The e2e tests tap the audio destination with an analyser, so "a note plays" means the output signal rose above a threshold and fell back to silence after release. A test that only checked that a button was pressed would have missed the original phone bug (sound that stops).

## Running locally

```bash
pnpm install
pnpm typecheck && pnpm lint && pnpm test && pnpm test:scripts && pnpm contrast
pnpm check:deps && pnpm check:tokens && pnpm check:sounds
pnpm build && pnpm check:budget
pnpm --filter @pro-studio/web exec playwright install chromium   # once
pnpm e2e                                   # Chromium only
E2E_ALL_BROWSERS=1 pnpm e2e                # also Firefox, WebKit, Pixel 7, iPhone 14 (installed browsers only)
VITE_BASE=/Pro-Studio-/ pnpm e2e           # the same tests against a build served under the Pages sub-path
```

## What CI cannot tell us

Emulation is not a phone. Playwright's iPhone profile uses the WebKit engine and a phone-sized touch screen, but it has no silent switch, no battery saver, no Bluetooth stack, no real audio hardware and no real power management. Firefox, WebKit and mobile projects are marked experimental in CI until they have passed once.

## Owner's device tests

Each takes about two minutes. Open the preview link (see `docs/REVIEW-AND-CI.md` for turning it on) or the Codespaces forwarded port. Report with the **Bug report** issue template: say what you heard, the device, browser, and audio output.

### Phone (iPhone or Android)

| # | Test | Steps | Pass looks like |
| --- | --- | --- | --- |
| P1 | Sound unlocks | Open the app. Tap an on-screen key. | You hear a note on the first tap and the status says sound is on. |
| P2 | Silent switch (iPhone) | Flip the ring/silent switch to silent. Tap keys. Flip back. Tap again. | Note which state is silent. Report both. (Browsers treat this differently; we need the real behaviour.) |
| P3 | Steady for a minute | Tap or hold keys on and off for 60 seconds. | No dropouts, crackles or sound that stops while you keep playing. This is the bug from the first prototype. |
| P4 | Lock and return | Lock the screen for 10 seconds, unlock, return to the browser. Tap a key. | Sound comes back on the first tap, or the app clearly says to tap to resume. Silence with no message is a bug. |
| P5 | Switch apps | Open another app for 20 seconds, come back, tap a key. | Same as P4. |
| P6 | Battery saver (Android) | Turn on battery saver, repeat P3. | Same as P3. Report if it degrades. |
| P7 | Bluetooth | Connect Bluetooth headphones, tap keys. | Say whether it feels late. Compare with wired or the phone speaker. |
| P8 | Touch comfort | Portrait and landscape: play a three-finger chord on the on-screen keys. | Keys are big enough, nothing overlaps, no accidental page scroll or zoom. |

### Laptop or desktop

| # | Test | Steps | Pass looks like |
| --- | --- | --- | --- |
| L1 | Keyboard piano | Press `Z X C V B N M` (white keys), `S D G H J` (black keys), `Q W E R T Y U` (next octave), `-` and `=` to change octave. | Notes sound and stop on release. Holding several keys plays chords. |
| L2 | Typing is safe | If a text field exists, type letters into it. | No notes play while typing. |
| L3 | Modes | Switch Beginner, Standard, Pro, reload the page. | The choice persists; what is shown changes; nothing you made is lost. |
| L4 | Output devices | Play through speakers, then headphones. | No distortion at normal volume; level is sensible. |
| L1b | Firefox | Repeat L1 in a real Firefox. | CI's headless Firefox read silence (see `docs/REVIEW-AND-CI.md`); this tells us whether it is a real bug or only the runner. |
| L5 | USB MIDI keyboard | Not built yet. Skip until the roadmap item ships. | n/a |

When a new feature ships it adds its own rows here in the same change.

## Rule for bugs

A bug found by hand becomes an automated test first, then a fix, so it cannot come back. If a test cannot reproduce it (hardware, OS), the issue stays open with the device details and a row in the tables above.
