---
applyTo: "apps/web/src/**,packages/ui/**"
---

# Web UI

- Use design tokens from `packages/ui/src/styles/tokens.css`. No hex colours, raw px sizes, radii or shadows in components or CSS. A new meaningful colour needs a token and a contrast pair for both themes.
- Gate features with `isFeatureVisible(id, mode)`; never fork a component per mode.
- Every control works. If something is a stub, label it in the UI and the code.
- Keyboard first: every command reachable by keyboard; icon-only controls have an accessible name; typing in an editable target must never trigger the piano or a shortcut (`isEditableTarget`).
- Canvas views need a parallel accessible model (focusable, arrow-key navigable, announced).
- Respect `prefers-reduced-motion`. Touch targets are at least 44 px in comfortable density.
- Heavy or timing-critical work stays out of render; send commands to the engine instead.
