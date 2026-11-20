# Professional Frontend Engineering Standard

> The owner's standing brief for every agent and contributor. It is a repository-level instruction: all UI work in this repo follows it. `docs/DESIGN-SYSTEM.md` says how the standard is implemented here, and `docs/ARCHITECTURE.md` lists the (few, deliberate) places where this product's needs differ from the generic defaults below.

## 1. Mission

Build production-quality frontend applications that meet the standards of experienced product designers and senior frontend engineers at established technology companies.

The objective is not simply to produce attractive interfaces. Every implementation must demonstrate:

- Professional visual design.
- Deliberate product design decisions.
- Consistent design-system implementation.
- Maintainable frontend architecture.
- High-quality interaction design.
- Responsive behaviour.
- Accessibility.
- Performance.
- Functional completeness.
- Verified visual accuracy.

Treat every screen as part of one cohesive product, not as an independent design exercise. Do not prioritize development speed over architectural integrity or visual quality.

## 2. Engineering philosophy

Follow established frontend engineering practices. Make decisions based on:

- Actual product requirements.
- User workflows.
- Content hierarchy.
- Existing project architecture.
- Maintainability.
- Browser behaviour.
- Accessibility requirements.
- Performance requirements.
- Design consistency.

Never introduce a technology, component, animation or visual effect without a reason. Inspect the existing codebase before making architectural changes. Preserve working functionality and avoid unnecessary rewrites. Do not introduce a competing design system or duplicate dependencies when an appropriate solution already exists.

## 3. Default technology stack

Use the following stack when appropriate:

- React
- TypeScript with strict type checking
- Next.js for applications requiring its routing and rendering architecture
- Tailwind CSS for utility-based styling
- CSS custom properties for design tokens
- CSS Grid and Flexbox for layout
- Radix UI or React Aria for accessible interaction primitives
- Lucide React for iconography
- TanStack Query for server state
- Zustand for shared client state when justified
- React Hook Form for forms
- Zod for validation
- Motion for purposeful animations
- TanStack Table for complex data tables
- Playwright for end-to-end and visual testing
- Vitest for unit testing
- Testing Library for component testing
- Storybook for component documentation when useful
- ESLint and Prettier for code quality

Do not install every technology automatically. Select dependencies according to actual requirements.

## 4. Typography

Use a deliberate typography system. Recommended general-purpose font choices: Inter, Geist, Public Sans, IBM Plex Sans, Plus Jakarta Sans. Use one primary interface font unless a second typeface serves a specific purpose. Use a monospace typeface for code, technical identifiers and appropriate numerical content.

Typography must define: font family, font size, font weight, line height, letter spacing, text color, semantic role.

Recommended desktop starting scale:

| Role | Size / weight |
| --- | --- |
| Display | 48px / 600 |
| Page heading | 32px / 600 |
| Section heading | 24px / 600 |
| Subheading | 20px / 600 |
| Component heading | 16px / 600 |
| Body | 16px / 400 |
| Secondary body | 14px / 400 |
| Small text | 13px / 400 |
| Labels | 12px / 500 |

Use relative units where appropriate and allow responsive typography. Use tabular numerals for aligned financial figures and numerical data. Avoid excessive boldness, unnecessary uppercase text and arbitrary typography sizes.

## 5. Iconography

Use Lucide React as the default icon library.

- Consistent icon family.
- 16-20px standard sizing; 20-24px for larger controls.
- Consistent stroke weight.
- Consistent optical alignment.
- Accessible labels for icon-only buttons.
- Tooltips where necessary.

Do not mix unrelated icon families or use emoji as application navigation icons. Do not add decorative icons without a clear communication purpose.

## 6. Design system

Create a centralized design system before extensive screen implementation. It must define: primitive colors, semantic color tokens, component color tokens, typography, spacing, border radius, borders, shadows, elevation, layout dimensions, motion durations, breakpoints, z-index layers, component states.

Use CSS custom properties as the source of truth. Never scatter arbitrary colors, spacing values, radius values or shadows throughout the application. Use semantic names rather than meaningless names (`--background`, `--surface`, `--surface-subtle`, `--border`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent`, `--success`, `--warning`, `--danger`).

Provide intentional light and dark theme definitions. Do not implement dark mode through simple color inversion.

## 7. Spacing and dimensions

Use a consistent 4px-based spacing system. Primary spacing values: 4, 8, 12, 16, 20, 24, 32, 40, 48 and 64px.

Suggested component dimensions:

- Standard input: 40-44px.
- Standard button: 40px.
- Large button: 44-48px.
- Compact button: 32-36px.
- Expanded sidebar: 240-260px.
- Collapsed sidebar: 64-76px.
- Top navigation: 56-64px.

These are starting values, not inflexible requirements. Define a limited radius system and use it consistently.

## 8. Visual design principles

Create a recognizable visual identity appropriate to the product. Prioritize: clear visual hierarchy, strong typography, balanced proportions, consistent spacing, precise alignment, controlled color usage, appropriate information density, subtle depth, clean borders, purposeful component grouping, readable content, consistent visual rhythm.

Use whitespace intentionally. Use cards only when they provide meaningful grouping or separation. Use shadows selectively. Do not apply gradients, glass effects, glows, excessive rounded corners or decorative illustrations without a deliberate design reason. Avoid generic AI-generated SaaS aesthetics. Do not make every page look like the same dashboard template. The visual language must reflect the product's purpose and brand.

## 9. Application layout

Establish a reusable application shell. Depending on the product, it may contain: sidebar, header, navigation, breadcrumbs, main content, contextual panels, notification layer, dialog and overlay layer.

Use CSS Grid for page-level composition and Flexbox for component-level alignment. Define maximum content widths where appropriate. Never rely on absolute positioning for the entire application layout. Design mobile, tablet and desktop behaviour intentionally. Do not simply compress desktop interfaces into mobile screens.

## 10. Component architecture

Build reusable, composable components. Separate design primitives, shared UI components, layout components, feature components and page components.

Create consistent implementations for buttons, inputs, selects, dialogs, drawers, tooltips, dropdowns, navigation, tables, cards, badges, alerts, toasts, loading indicators, empty states and form fields.

Every interactive component must implement relevant states: default, hover, focus-visible, pressed, disabled, loading, selected, error.

Do not duplicate component implementations across screens. Do not over-engineer trivial elements into unnecessary abstractions.

## 11. CSS engineering

Maintain organized and predictable CSS:

- Centralized tokens.
- Controlled cascade.
- Clear stylesheet responsibilities.
- Limited specificity.
- Minimal use of `!important`.
- No arbitrary magic numbers.
- No repeated conflicting overrides.
- No unnecessary global selectors.
- No unused styles.
- No uncontrolled inline styling.
- Consistent responsive rules.

Use Tailwind for efficient composition where appropriate, but retain custom CSS for complex layouts and visual requirements. Never treat Tailwind's default appearance as the final design.

## 12. Application architecture

Separate presentation, application logic, state management and data access.

- React state for local interaction state.
- TanStack Query for server state.
- URL parameters for shareable navigation and filtering state.
- Zustand for justified shared client state.
- React Hook Form for complex form state.
- Zod for input validation.

Do not mix all application responsibilities inside large page components. Create clear feature boundaries. Use strict TypeScript types. Handle loading, success, empty, error and retry states. Do not invent data or display fake success messages. Protect permissions on the server, not merely through frontend navigation.

## 13. Interaction design

Every interactive element must perform its intended function. Implement button actions, navigation, dropdown behaviour, form validation, search, filtering, sorting, pagination, keyboard interaction, dialog dismissal, focus management, loading feedback, error feedback and confirmation where necessary.

Do not use decorative or nonfunctional controls. Do not simulate backend functionality without explicitly identifying it as a prototype.

## 14. Animation

Use animation to clarify state changes and improve feedback. Prefer short, controlled transitions. Use animation for menus, dialogs, drawers, tabs, notifications, loading feedback, expandable sections and drag interactions. Avoid excessive movement, bouncing, continuous decoration and unnecessary page transitions. Respect reduced-motion preferences. Never sacrifice responsiveness for animation.

## 15. Accessibility

Target WCAG 2.2 AA. Implement semantic HTML, correct heading hierarchy, keyboard navigation, visible focus, accessible labels, screen-reader support, accessible dialogs, form error associations, sufficient contrast, reduced motion and appropriate touch targets.

Minimum text contrast: 4.5:1 for normal text, 3:1 for large text. Never communicate essential information through color alone.

## 16. Performance

Optimize rendering, JavaScript bundle size, image delivery, font loading, data fetching, caching, component updates, large lists and layout stability. Use lazy loading and code splitting when appropriate. Avoid unnecessary dependencies. Measure Core Web Vitals. Targets: LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1. Measure actual application performance rather than assuming it is fast.

## 17. Responsive engineering

Test mobile, tablet, laptop, desktop and wide desktop. Use content-driven breakpoints. Check horizontal overflow, text wrapping, navigation behaviour, touch targets, table presentation, dialog sizing, sidebar behaviour, image scaling and safe areas. Responsive quality must be designed, not added as an afterthought.

## 18. Pixel-perfect implementation

Before accepting a screen:

1. Understand its requirements.
2. Establish its information hierarchy.
3. Define its layout.
4. Map its components to the design system.
5. Implement the screen.
6. Run the application.
7. Capture browser screenshots.
8. Compare against the approved reference.
9. Identify discrepancies.
10. Correct their underlying causes.
11. Repeat the inspection.
12. Test responsive layouts.
13. Verify functionality.
14. Verify accessibility.
15. Accept only after review.

Inspect spacing, typography, alignment, dimensions, borders, colors, radius, shadows, icon positioning, content overflow and component states. Do not claim pixel-perfect quality without actual visual verification. Do not hardcode every element's position to match one screenshot; the implementation must remain responsive and maintainable.

## 19. Testing and quality control

Use appropriate combinations of Vitest, React Testing Library, Playwright, axe-core, Storybook and visual regression testing.

Check: browser console, network failures, broken assets, incorrect fonts, layout shifts, overflow, keyboard interaction, component states, data errors, responsive rendering. Fix the underlying problem rather than applying superficial CSS patches.

## 20. Strict prohibitions

Do not:

- Use generic AI dashboard templates.
- Default to blue/purple gradients.
- Use unnecessary glassmorphism.
- Fill every screen with cards.
- Overuse rounded corners.
- Add decorative charts without meaningful data.
- Invent statistics or records.
- Use emoji for interface iconography.
- Randomly mix fonts.
- Randomly mix icon libraries.
- Use arbitrary font sizes.
- Create inconsistent spacing.
- Add unnecessary animation.
- Build fake functionality.
- Leave buttons without actions.
- Hide errors.
- Ignore responsive layouts.
- Ignore accessibility.
- Duplicate existing components.
- Introduce unnecessary dependencies.
- Rewrite working architecture without justification.
- Claim completion without verification.

## 21. Final acceptance standard

Every deliverable must satisfy five dimensions:

1. **Design quality**: visually coherent, deliberate, recognizable and polished.
2. **Engineering quality**: maintainable, modular, typed and architecturally sound.
3. **Functional quality**: every required interaction works correctly.
4. **User experience**: intuitive, responsive, accessible and predictable.
5. **Verification quality**: tested, inspected and free of known critical defects.

Never equate code generation with engineering completion. The standard is not whether the interface looks impressive in one screenshot. The standard is whether the entire application feels like a carefully designed and professionally engineered product.

## Release gate (all required before a screen is "done")

- [ ] Design tokens and typography followed
- [ ] Component architecture reviewed
- [ ] Desktop screenshot inspected
- [ ] Mobile screenshot inspected
- [ ] No layout overflow or alignment defects
- [ ] All controls and interactions tested
- [ ] Loading, empty and error states implemented
- [ ] Keyboard and accessibility checks passed
- [ ] Browser console and network checked
- [ ] Performance and visual regression tests passed
