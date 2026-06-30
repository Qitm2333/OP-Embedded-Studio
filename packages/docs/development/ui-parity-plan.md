# UI parity and hardening plan

OpenPencil's headless editor architecture is moving in the right direction: the Vue SDK exposes renderless primitives and composables, while the app shell owns product-specific presentation. The current app UI is still MVP-grade. This plan turns the existing shell into a Figma-grade, maintainable interface without weakening the headless SDK boundary.

## Goals

- Preserve the headless SDK model: controls and editor logic live in `packages/vue/src/**`; the app shell renders opinionated OpenPencil UI in `src/components/**`.
- Replace ad-hoc panel markup with reusable UI primitives so future feature work is fast and consistent.
- Make large documents feel production-grade, especially the Layers panel.
- Close high-impact Figma panel gaps: mixed values, constraints, stroke caps/joins, corner smoothing, shared styles, component properties, and richer typography.
- Add guardrails so UI quality does not regress.

## Current assessment

### Strong foundation

- `packages/vue/src/primitives/**` already follows a useful renderless-root pattern similar to Reka UI.
- `packages/vue/src/controls/**` keeps much property editing logic outside app components.
- App components use `data-test-id` consistently enough to support reliable regression tests.
- The menu and command registry direction is healthy and should remain the canonical source for shortcuts and command behavior.

### Main gaps

- `src/components/ui/**` is mostly class factories, not a complete UI kit. App sections repeatedly hand-build icon buttons, panel rows, toggle groups, and section headers.
- Several templates call `use*UI()` helpers inline, which recomputes variants during render and spreads design-system knowledge into many files.
- Some components still use raw inline SVG icons, which creates inconsistent visual language and violates the project convention.
- `PropertyListRoot` erases item types, causing casts and non-null assertions in property sections.
- `LayerTreeRoot` rebuilds and remounts the whole tree on every scene mutation via `sceneVersion` and `treeKey`, which will not scale to real `.fig` documents.
- Multi-select mixed values are not a first-class editing state across the panel.
- Important Figma-like controls are missing or incomplete in the UI even when the scene graph or renderer already supports the data.

## Phase 1: Build the panel UI kit

**Purpose:** Create shared components for the repeated panel patterns before adding new features.

### Files to add or refactor

- `src/components/ui/IconButton.vue`
- `src/components/ui/SegmentedControl.vue`
- `src/components/ui/PanelSection.vue`
- `src/components/ui/PanelRow.vue`
- `src/components/ui/panel.ts` for slot variants and shared panel class composition
- Optional icon namespace under `src/components/icons/` or an Iconify custom collection for OpenPencil-specific micro-icons

### Work items

1. Add `IconButton.vue` that owns tooltip wrapping, icon rendering, size variants, pressed/active state, disabled state, and test-id forwarding.
2. Add `SegmentedControl.vue` for small enumerations currently rendered as repeated toggle buttons or dropdowns.
3. Add `PanelSection.vue` for the standard section wrapper, label, optional add button, optional collapse toggle, and action slot.
4. Add `PanelRow.vue` for fixed-density property rows and common two-column input layout.
5. Replace repeated button markup in:
   - `src/components/properties/PositionSection.vue`
   - `src/components/properties/StrokeSection.vue`
   - `src/components/properties/EffectsSection.vue`
   - `src/components/properties/ExportSection.vue`
   - `src/components/properties/FillSection.vue`
   - `src/components/properties/AppearanceSection.vue`
   - `src/components/AssetsPanel.vue`
   - `src/components/AppMenu.vue`
6. Replace raw inline SVGs in app templates with icon components.
7. Hoist all `use*UI()` calls out of templates into `<script setup>` constants/computed values, or hide them inside the new UI components.

### Acceptance criteria

- `rg 'use\w+UI\(' src/components --glob '*.vue'` has no matches inside template blocks.
- `rg '<svg' src/components --glob '*.vue'` returns zero, except for explicitly approved third-party content rendering.
- Position, Stroke, Effects, Export, Fill, and Appearance sections use `PanelSection` and `PanelRow`.
- Toggle-button visual states are implemented once through `SegmentedControl` or `IconButton` variants.

## Phase 2: Fix typed property-list boundaries

**Purpose:** Remove template casts and non-null assertions by making renderless primitives expose precise slot types.

### Files to refactor

- `packages/vue/src/primitives/PropertyList/PropertyListRoot.vue`
- `packages/vue/src/primitives/PropertyList/context.ts`
- `packages/vue/src/controls/stroke/helpers.ts`
- `src/components/properties/StrokeSection.vue`
- `src/components/properties/EffectsSection.vue`
- `src/components/properties/FillSection.vue`
- `src/components/properties/LayoutSection/SizeControls.vue`

### Work items

1. Make `PropertyListRoot` generic over the array prop key (`fills`, `strokes`, `effects`) so slot props expose `Fill[]`, `Stroke[]`, or `Effect[]` exactly.
2. Use `defineSlots` to document the slot contract and preserve type information in consuming templates.
3. Change the slot shape so consumers do not need `activeNode!`; provide guarded actions or null-safe helpers instead.
4. Move stroke dash-pattern and independent-side logic from `StrokeSection.vue` into `packages/vue/src/controls/stroke/helpers.ts`.
5. Replace fake node casts with explicit helper functions that operate on real nodes and return typed patches.

### Acceptance criteria

- `rg 'as Stroke|as Fill|as Effect|as unknown|activeNode!' src/components --glob '*.vue'` returns zero.
- `StrokeSection.vue` becomes mostly markup and delegates stroke-specific mutations to SDK helpers.
- `bun run check` passes.

## Phase 3: Rewrite the Layers panel for scale

**Purpose:** Make the Layers panel usable on large imported Figma documents.

### Files to refactor

- `packages/vue/src/primitives/LayerTree/LayerTreeRoot.vue`
- `packages/vue/src/primitives/LayerTree/LayerTreeItem.vue`
- `packages/vue/src/primitives/LayerTree/context.ts`
- `packages/vue/src/primitives/LayerTree/useLayerDrag.ts`
- `src/components/LayerTree.vue`
- New app namespace: `src/components/LayerTree/LayerRow.vue`, `LayerRowRename.vue`, `LayerRowActions.vue`, `DropIndicator.vue`

### Work items

1. Replace the recursive tree object with a flat visible-row model derived from the current page and expanded state.
2. Remove `treeKey` remounting. Tree state must survive node edits, scroll, rename focus, and dragging.
3. Subscribe to editor lifecycle events instead of watching only `sceneVersion`:
   - `node:created`
   - `node:updated`
   - `node:deleted`
   - `node:reparented`
   - `node:reordered`
   - `page:changed`
   - `selection:changed`
4. Patch rows incrementally for name, visibility, lock, and type changes. Rebuild the flat visible list only for structural changes and expansion changes.
5. Add virtualization over the flat row list. Use fixed row height and keep selection scroll-to behavior by index rather than by per-row DOM refs.
6. Split the 200+ line app template into row subcomponents.
7. Add range selection with Shift and preserve additive selection with Cmd/Ctrl.
8. Add focused and unfocused selected-row visual states.

### Acceptance criteria

- Scrubbing a selected node's X/Y/W/H no longer remounts the Layers tree.
- Scroll position and rename focus survive unrelated scene updates.
- A 5,000-node document remains responsive while editing properties.
- Add tests under `tests/engine/vue/` for visible-row derivation and under `tests/e2e/perf/` for large-tree interaction.

## Phase 4: Make mixed values first-class

**Purpose:** Multi-select editing should behave like Figma, not like first-node editing.

### Files to refactor

- `packages/vue/src/controls/node-props/helpers.ts`
- `packages/vue/src/controls/prop-scrub/use.ts`
- `packages/vue/src/primitives/ScrubInput/**`
- Every property section under `src/components/properties/**`

### Work items

1. Promote the existing `MIXED` symbol into a public SDK concept for control roots.
2. Make `ScrubInputRoot` and the app `ScrubInput.vue` display a mixed placeholder and commit typed input to all selected nodes.
3. Add mixed display semantics to color rows, selects, segmented controls, toggles, and variable-bound inputs.
4. Ensure each panel section distinguishes:
   - inactive/not applicable
   - empty list
   - mixed value
   - explicit value
5. Add e2e coverage for multi-select editing: position, fill, stroke, opacity, typography, effects, and layout.

### Acceptance criteria

- Multi-select no longer silently displays the first selected node's value as if it applied to all nodes.
- A mixed field shows a clear mixed placeholder and a first edit applies uniformly to all selected nodes.
- Mixed array props (`fills`, `strokes`, `effects`) show clear add/replace behavior.

## Phase 5: Close high-impact Figma panel gaps

Each item should be implemented as SDK logic plus app presentation. Do not put durable editing logic directly in app components.

### 5.1 Constraints

- Add `packages/vue/src/controls/constraints/use.ts`.
- Add `packages/vue/src/primitives/ConstraintsControl/`.
- Add `src/components/properties/ConstraintsSection.vue`.
- Use a Figma-style pin/grid control plus horizontal and vertical mode selectors.

### 5.2 Stroke caps, joins, and miter limit

- Extend `packages/vue/src/controls/stroke/**`.
- Extend `src/components/properties/StrokeSection.vue`.
- Use segmented controls for cap and join modes; use a scrub input for miter limit.

### 5.3 Corner smoothing and independent corners

- Extend `packages/vue/src/controls/appearance/**`.
- Extend `src/components/properties/AppearanceSection.vue`.
- Add smoothing control and independent-corner presentation that does not depend on inline SVGs.

### 5.4 Shared styles

- Add or expose core model support for fill, stroke, text, effect, and grid style identifiers.
- Add SDK controls for style binding/unbinding.
- Add app UI in Fill, Stroke, Typography, Effects, and future Layout Grid sections.
- Preserve Figma style IDs on import/export where safe.

### 5.5 Component properties

- Add `packages/vue/src/controls/component-props/use.ts`.
- Add `src/components/properties/ComponentPropsSection.vue`.
- Expose text, boolean, variant, and instance-swap properties when available.

### 5.6 Blend modes and effect styles

- Extend Fill and Effects sections with blend-mode pickers.
- Add effect style binding once shared styles exist.

### 5.7 Typography depth

- Extend Typography controls for text case, vertical alignment, justification, truncation/max lines, and OpenType/font variation fields where supported by the scene graph and renderer.

### Acceptance criteria

- Each new capability has SDK control tests and at least one app e2e test.
- New sections are renderless-friendly: third-party shells can use the SDK logic without OpenPencil app components.

## Phase 6: Polish interaction and density

**Purpose:** Make the panels feel precise and Figma-like.

### Work items

1. Standardize panel density:
   - 28px control rows
   - consistent section padding
   - consistent 4px/8px row gaps
   - strict two-column input rhythm for paired numeric fields
2. Extend `src/app.css` theme tokens:
   - selected row background
   - selected row unfocused background
   - panel secondary background
   - subtle border/focus tokens
   - warning/success/action states for both dark and light themes
3. Extend scrub input interactions:
   - Shift-drag for coarse increments
   - modifier-drag for fine increments
   - ArrowUp/ArrowDown increments
   - math expression commit if a safe dependency or parser is selected deliberately
4. Add consistent focus rings and keyboard navigation for panel fields, segmented controls, and layer rows.
5. Audit empty, disabled, and not-applicable states for all property sections.
6. Align toolbar flyout grouping with design-tool expectations: selection/move tools, frame/section tools, shape tools, drawing tools, text/comment/resource tools.

### Acceptance criteria

- Panel screenshot tests cover single rectangle, text selection, multi-select, instance selection, empty canvas, and layer tree with nested groups.
- Keyboard-only panel navigation works for the main property sections.
- No one-off raw Tailwind control rows remain outside the shared panel primitives unless explicitly justified.

## Phase 7: Testing and guardrails

### Tests to add

- `tests/e2e/panels/visual.spec.ts` for DOM screenshots of panels.
- `tests/e2e/properties/mixed-values.spec.ts`.
- `tests/e2e/layers/large-tree.spec.ts` or `tests/e2e/perf/layers.spec.ts`.
- `tests/engine/vue/layer-tree.test.ts` for flat visible-row derivation.
- SDK-level tests for each new control under existing engine/vue coverage patterns.

### Static checks to add

- No `use*UI()` calls inside Vue templates.
- No raw `<svg>` inside app templates unless the file is explicitly allowlisted.
- No `as Stroke`, `as Fill`, `as Effect`, or non-null `activeNode!` in app templates.
- No new property-section component over 250 lines without a documented split.

## Recommended sequencing

1. **Phase 1:** UI kit consolidation.
2. **Phase 2:** typed property-list boundaries.
3. **Phase 4:** mixed values, because it affects every future section.
4. **Phase 3:** Layers rewrite can run in parallel with 1-2 because it touches a separate surface.
5. **Phase 5:** feature parity streams in parallel after 1, 2, and 4.
6. **Phase 6:** density and interaction polish continuously, but final pass after 5.
7. **Phase 7:** add guardrails as soon as Phase 1 introduces replacement patterns.

## Parallel worktree split

Suggested future-agent branches:

- `ui-kit-foundation`: Phase 1 and related guardrails.
- `property-list-types`: Phase 2.
- `layers-virtualized`: Phase 3.
- `mixed-values`: Phase 4.
- `constraints-section`: Phase 5.1.
- `stroke-controls-parity`: Phase 5.2.
- `appearance-corners`: Phase 5.3.
- `shared-styles`: Phase 5.4.
- `component-props-panel`: Phase 5.5.
- `typography-depth`: Phase 5.7.

## Definition of done

OpenPencil's UI moves out of MVP status when:

- Panels are composed from shared panel primitives rather than ad-hoc markup.
- Large layer trees are virtualized and incremental.
- Mixed values behave predictably across multi-select.
- The highest-impact Figma-compatible properties are editable in the UI.
- Screenshot and static checks prevent visual and structural regression.
- SDK controls remain reusable by custom shells, preserving the broader goal of building OpenPencil as a set of Lego-like packages for custom Figma-like editors.
