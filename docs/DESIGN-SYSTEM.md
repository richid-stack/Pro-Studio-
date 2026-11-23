# Design system

Implements `docs/FRONTEND_ENGINEERING_STANDARD.md` for a dense music-production tool. Source of truth: `packages/ui/src/styles/tokens.css`. If this document and the CSS disagree, the CSS wins and this file is wrong.

## Identity: Slate & Amber

A studio is a dim room where the screen should disappear and the music should stand out, but a beatmaker also expects the tool to feel like hardware: carved panels, lit buttons, a glass LCD. The look is taken from butterDAWg (see Provenance) and rebuilt on our own tokens.

- **Slate surfaces** (`--bg`, `--surface-inset`, `--surface-1..4`) sit on a mid-grey **desk** (`--desk`). Each panel is a carved frame (`--surface-2`, bevel border) around an inset well (`--surface-1`).
- **Chrome** is the top bar and its LCDs: `--chrome-bar`, `--chrome-menu`, `--chrome-lcd`, `--chrome-text`, `--chrome-hint`, with `--well`/`--well-edge` for recessed areas and `--bevel-dark`/`--bevel-light` for the 2 px bevel.
- **One accent, amber** (`--accent`), used for the primary action, selection, the playhead and focus-adjacent emphasis.
- **Lit buttons.** A pressed toggle (`aria-pressed="true"`) is a lit key: white core (`--lit-core`), orange glow rim (`--lit-glow`, `--lit-rim`), dark ink (`--lit-ink`). State is never colour alone: lit buttons also change shape cue (inset bevel) and expose `aria-pressed`.
- **Colour is reserved for meaning:** 12 channel colours (`--ch-1..12`), meters (`--meter-ok/warn/clip`), `--led-on`, `--record`, status colours.
- **Texture is allowed, decoration is not.** Gradients and glows are used only where hardware has them: button caps (`--pill-from/to`), fader caps (`--cap-top/bottom`), knob faces (`--knob-face`), lit buttons and the LCD inset glow (`--glow-inset`). Panels and content areas stay flat. Shadows on popovers and modals, plus the knob and fader caps.
- Dark is the default. A designed light theme exists (`data-theme="light"`) with its own desk, chrome, accent, channel and meter colours, not an inversion.

## Tokens (three tiers)

1. **Primitives** (`--slate-*`, `--paper-*`, `--ink-*`, `--amber-*`, type scale, `--space-*`, `--radius-*`, durations, z-index). Never used directly in components.
2. **Semantic** (`--bg`, `--surface-*`, `--text-primary|secondary|muted|disabled`, `--accent*`, `--success|warning|danger`, `--border-*`, `--playhead`, `--selection-fill`, `--grid-*`). What components use.
3. **Component** tokens live beside the component (`button.css` etc.) and are defined from semantic tokens.

Cascade order: `@layer reset, tokens, base, components, utilities;` (`packages/ui/src/styles/index.css`).

## Type

Inter for the interface, JetBrains Mono for numbers and technical readouts (`.t-num`, tabular numerals so BPM, time and dB do not jitter). Sizes: 11 / 12 / 13 / 14 / 16 / 20 / 24 / 32 px. Body is **13 px** (the standard's "small text") because this is a dense tool; nothing is below 11 px and 11 px is used only for shortcut hints and fine print. Weights 400 / 500 / 600; labels are uppercase 11 px with `0.04em` tracking and are used sparingly.

## Space, shape, motion

- 4 px spacing scale (`--space-1..16`).
- Radii: 3, 4, 6, 10, 14 px and pill (`--radius-sm` is 3 px, the hardware corner). Controls use 3-6, panels 6-10, dialogs 10-14.
- Motion: 80 / 120 / 180 / 260 ms, three easings. Used for hover, popovers, panel maximize and drag feedback only. `prefers-reduced-motion` collapses all of it.

## Density

Compact is the default: control height 28 px, row 30 px, panel header 32 px, top bar 48 px. `data-density="comfortable"` raises these to 40 / 40 / 40 / 56 and the minimum hit target to 44 px for touch and accessibility. The standard's 40 px control is therefore the comfortable setting, not the default, a documented deviation (see ARCHITECTURE section 8).

Each mode sets a default density (`MODE_DEFAULTS` in `@pro-studio/shared`): Beginner comfortable, Standard and Pro compact. The user can override it independently of the mode.

## Accessibility is enforced, not hoped for

`pnpm contrast` (`packages/ui/scripts/check-contrast.mjs`) resolves every token in both themes and fails CI below WCAG 2.2 AA:

- 4.5:1 for text, accent-on-surface, status colours on every panel surface, text on the accent fill, and the text colour used on every channel colour.
- 3:1 for control borders, the focus ring, meters, the playhead and every channel colour on the panel surfaces.
- The light theme must redefine every colour token the dark theme does, so nothing silently inherits a dark value.

Currently 114 pairs per theme pass (the chrome, lit-button, LED and record pairs came with Slate & Amber). Add a pair to the script when you add a token that carries meaning.

Other rules: one focus style for the whole product (`:focus-visible`, 2 px, `--focus-ring`); no status by colour alone (every meter and state also has a shape, label or position cue); every icon-only control has an accessible name.

## Icons

`apps/web/src/components/Icon.tsx` is our own set, drawn from scratch on a 20 x 20 grid. No third-party icon font or pack.

- **Two tones.** Each icon is layers: `f` fill (full colour), `t` tint (same colour at `--icon-tone-opacity`), `l` line, `m` mark (small detail), `s` soft line. The tint gives the "keycap" depth without a second colour, so icons follow `currentColor` and work in both themes and on lit buttons.
- **Sizes** are tokens: `--icon-sm` 16 px, `--icon-md` 20 px, `--icon-lg` 24 px. Stroke weights are set per layer so a small icon does not go muddy.
- **Names** are a closed union (`IconName`); `ICON_NAMES` feeds the contact sheet used to review the set in both themes. Add an icon by drawing it on the grid, adding the name, and checking it on the sheet at all three sizes.
- Icon-only controls still need an accessible name (the icon is `aria-hidden`).

## Components (planned in `@pro-studio/ui`, Phase 1)

Button (primary, secondary, ghost, danger, icon, toggle), Knob, Fader, Meter, Slider, NumberField (drag to scrub, type to enter), Select, Tabs, Panel (header, maximize, collapse), Splitter, Toolbar, Tooltip, Menu and ContextMenu, Dialog, Toast, CommandPalette, Icon. Each ships with default, hover, focus-visible, pressed, disabled, selected and error states, a Testing Library test and a keyboard test. Knobs and faders are real ARIA sliders: arrow keys, Home/End, Page keys, and `Shift` for fine adjustment.

## Verification

A screen is accepted per the release gate in the standard: screenshots at 390, 768, 1280 and 1920 px reviewed, axe passes, keyboard-only pass, console and network clean. Design intent is never claimed "pixel-perfect" without that evidence.

## Provenance

The colour values, bevel and lit-button treatment, and the overall "hardware panel on a desk" language follow the owner's repository butterDAWg (github.com/richid-stack/butterDAWg, MIT licence). What we took is the design language: tokens and values re-expressed in our own semantic token names and our own CSS. We did not copy its source files, and every icon is drawn here. Do not import from it (see `CLAUDE.md` rule 9). Before a public release, copy its licence and copyright line verbatim into the credits page (Phase 8 audit); this has not been done yet because the licence text was not reachable when this was written.
