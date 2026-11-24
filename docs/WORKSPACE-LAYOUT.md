# Workspace layout

Decision (owner, 2026-11-20): the workspace should feel instantly familiar to anyone who has used a pattern-based DAW such as FL Studio, with Pro Studio's own identity and engineering on top.

## What we take from the convention

The panel set, where each panel sits, and the vocabulary. These are workflow conventions, not anyone's artwork.

| Panel | Where (default "Beat" workspace) | What it holds |
| --- | --- | --- |
| Transport bar | Top, full width | Menu (File, Edit, Add, Patterns, View, Options, Tools, Help); pattern/song mode, play, stop, record; tempo; time display; CPU and voice meters; tool buttons that open panels |
| Browser | Left, collapsible | Tabs (All, Project, Sounds, Starred; Plugins arrives with insert effects); search; folder tree of the project's channels, the sounds and the starter beats; drag a sound onto the channel rack |
| Channel rack | Top, left of centre | One row per channel: mute, pan and volume knobs, name button, 16-step grid in groups of four; right-click a step for ratchet/roll and velocity; clicking the name opens the piano roll |
| Piano roll | Top, centre (can float as a window, maximize, or fill the screen in focus mode) | Piano keys on the left that play the note when clicked, scrollable and zoomable note grid, tools (draw, select, slice, mute, zoom), a velocity lane and a selectable control lane underneath |
| Playlist | Top, right of centre | Track list on the left, timeline with bar numbers, pattern clips, audio clips and automation clips |
| Mixer | Bottom, full width | Vertical strips with fader, pan, meter, mute, solo; a master strip; insert effect slots on the selected strip |

Workspace presets: **Beat** (above), **Arrange** (playlist large), **Mix** (mixer large), **Performance** (pads and keys). Every panel can be resized, scrolled, zoomed and maximized (double-click the header or `Shift+F`); the piano roll also has a focus mode. Below the tablet breakpoint the workspace becomes one panel at a time with bottom navigation, designed for touch rather than shrunk.

## The browser in use

Pointer: click a folder to open or close it; click a sound to hear it (the speaker button turns that off); double-click, or the plus button on the row, adds it as a channel and selects it; drag it onto the channel rack to add it there; the star keeps it in the Starred tab. A starter beat replaces the project and one Undo brings the previous project back.

Keyboard: Up and Down walk the rows, Right opens a folder or steps into it, Left closes it or steps out, Home and End jump, a letter jumps to the next name starting with it, Space hears a sound, Enter adds or opens, Alt+S stars. Letters typed in the tree never reach the typing piano. In Beginner a short line explains the clicks; Standard and Pro add tag chips. Search words, tags and the active row are not saved; the tab, stars, open folders and the preview setting are.

## Windows

Standard and Pro (the `floating-windows` feature; Beginner keeps the fixed dock, and the phone layout is one panel at a time) let any panel leave the dock and float above it. The model is in `packages/shared/src/floating.ts`; the component is `FloatingWindow`.

Pointer:

- **Pop out:** the pop-out button on a docked panel's title bar, or drag the title bar more than 8 px and the panel becomes a window that follows the pointer.
- **Move:** drag the title bar. A window can hang partly off either side but its title bar never goes above the workspace or below its last 40 px, so it can always be grabbed.
- **Resize:** any edge or corner (the bottom-right corner shows a grip). A window stops at its panel's minimum size and the opposite side stays where it was. The moving side cannot leave the workspace.
- **Stack:** clicking or focusing a window raises it. The top window has the lit border.
- **Fold:** collapse a window to its title bar and expand it again. **Maximize:** double-click the title bar or use the button; restoring returns to the window. **Dock:** the dock button puts the panel back in its slot. **Close:** hides the panel (its place is remembered); the View menu shows it again.
- **Escape** while dragging cancels the move or resize.

Keyboard: focus a window's title and use the arrow keys to move it 16 px, Shift+arrows to resize it 16 px, and Ctrl for 64 px. The View menu has Cascade windows, Tile windows (falls back to cascade when no grid fits the workspace) and Dock all windows.

A floating panel takes no room in the dock, so the docked panels reflow to fill it. Window positions are saved with the layout, are pulled back inside the workspace if the browser window gets smaller (the saved place is kept, so making the window bigger again restores it), and are never part of the project. Switching to a layout preset docks everything.

## What is ours

- **Visual identity.** Our own tokens, type and icons, with the "hardware panel on a desk" language taken from the owner's butterDAWg (see `docs/DESIGN-SYSTEM.md`, Provenance). We do not reproduce another product's skin, icon set, logo or artwork, and we do not use its trademarks in the UI.
- **Three modes** (Beginner, Standard, Pro) through one layout: Beginner shows fewer panels with guidance, Pro shows every control.
- **Engineering:** audio on its own thread, an accessible model behind every canvas view, full keyboard control, real undo, local-first autosave.
- **Features FL Studio does not have:** tracked in `docs/BEYOND-FL.md`.

## Acceptance for the workspace

Each screen is verified in a real browser before it is called done: screenshots at 390, 768, 1280 and 1920 px in both themes, no console errors, no failed requests, keyboard-only pass, no horizontal overflow, and every control works. Screenshots are shared with the owner when the workspace first renders and after each significant change.
