# Design system

Implements `docs/FRONTEND_ENGINEERING_STANDARD.md` for a dense music-production tool. Source of truth: `packages/ui/src/styles/tokens.css`. If this document and the CSS disagree, the CSS wins and this file is wrong.

## Identity: Graphite & Amber

A studio is a dim room where the screen should disappear and the music should stand out. So:

- **Cool graphite surfaces** in six steps (`--bg`, `--surface-inset`, `--surface-1..4`) separated by thin borders, not shadows.
- **One accent, amber** (`--accent`), used for the primary action, selection, the playhead and focus-adjacent emphasis. Nothing else is amber.
- **Colour is reserved for meaning:** 12 channel colours (`--ch-1..12`), meters (`--meter-ok/warn/clip`), status colours. Because chrome is neutral, a channel colour or a clipping meter is instantly legible.
- **No gradients, glows or glass.** Depth comes from surface steps and borders. Shadows are only for popovers and modals.
- Dark is the default. A designed light theme exists (`data-theme="light"`): it has its own accent (`--amber-700`), its own channel colours and its own meter colours, not an inversion.

## Tokens (three tiers)

1. **Primitives** (`--gray-*`, `--amber-*`, type scale, `--space-*`, `--radius-*`, durations, z-index). Never used directly in components.
2. **Semantic** (`--bg`, `--surface-*`, `--text-primary|secondary|muted|disabled`, `--accent*`, `--success|warning|danger`, `--border-*`, `--playhead`, `--selection-fill`, `--grid-*`). What components use.
3. **Component** tokens live beside the component (`button.css` etc.) and are defined from semantic tokens.

Cascade order: `@layer reset, tokens, base, components, utilities;` (`packages/ui/src/styles/index.css`).

## Type

Inter for the interface, JetBrains Mono for numbers and technical readouts (`.t-num`, tabular numerals so BPM, time and dB do not jitter). Sizes: 11 / 12 / 13 / 14 / 16 / 20 / 24 / 32 px. Body is **13 px** (the standard's "small text") because this is a dense tool; nothing is below 11 px and 11 px is used only for shortcut hints and fine print. Weights 400 / 500 / 600; labels are uppercase 11 px with `0.04em` tracking and are used sparingly.

## Space, shape, motion

- 4 px spacing scale (`--space-1..16`).
- Radii: 2, 4, 6, 10, 14 px and pill. Controls use 4-6, panels 6-10, dialogs 10-14.
- Motion: 80 / 120 / 180 / 260 ms, three easings. Used for hover, popovers, panel maximize and drag feedback only. `prefers-reduced-motion` collapses all of it.

## Density

Compact is the default: control height 28 px, row 30 px, panel header 32 px, top bar 48 px. `data-density="comfortable"` raises these to 40 / 40 / 40 / 56 and the minimum hit target to 44 px for touch and accessibility. The standard's 40 px control is therefore the comfortable setting, not the default, a documented deviation (see ARCHITECTURE section 8).

Each mode sets a default density (`MODE_DEFAULTS` in `@pro-studio/shared`): Beginner comfortable, Standard and Pro compact. The user can override it independently of the mode.

## Accessibility is enforced, not hoped for

`pnpm contrast` (`packages/ui/scripts/check-contrast.mjs`) resolves every token in both themes and fails CI below WCAG 2.2 AA:

- 4.5:1 for text, accent-on-surface, status colours on every panel surface, text on the accent fill, and the text colour used on every channel colour.
- 3:1 for control borders, the focus ring, meters, the playhead and every channel colour on the panel surfaces.
- The light theme must redefine every colour token the dark theme does, so nothing silently inherits a dark value.

Currently 99 pairs per theme pass. Add a pair to the script when you add a token that carries meaning.

Other rules: one focus style for the whole product (`:focus-visible`, 2 px, `--focus-ring`); no status by colour alone (every meter and state also has a shape, label or position cue); every icon-only control has an accessible name.

## Components (planned in `@pro-studio/ui`, Phase 1)

Button (primary, secondary, ghost, danger, icon, toggle), Knob, Fader, Meter, Slider, NumberField (drag to scrub, type to enter), Select, Tabs, Panel (header, maximize, collapse), Splitter, Toolbar, Tooltip, Menu and ContextMenu, Dialog, Toast, CommandPalette, Icon. Each ships with default, hover, focus-visible, pressed, disabled, selected and error states, a Testing Library test and a keyboard test. Knobs and faders are real ARIA sliders: arrow keys, Home/End, Page keys, and `Shift` for fine adjustment.

## Verification

A screen is accepted per the release gate in the standard: screenshots at 390, 768, 1280 and 1920 px reviewed, axe passes, keyboard-only pass, console and network clean. Design intent is never claimed "pixel-perfect" without that evidence.
