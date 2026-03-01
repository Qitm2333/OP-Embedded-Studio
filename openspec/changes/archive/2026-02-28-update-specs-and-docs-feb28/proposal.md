## Why

39 new commits landed on master after the initial baseline specs and VitePress docs were created. These commits introduce sections, multi-page documents, hover highlight, .fig export, tier 1 rendering (gradients/images/effects), fill type picker, new node types, and extensive new tests. The OpenSpec specs and VitePress docs are now stale and need to reflect the current state.

## What Changes

- Update existing OpenSpec specs with new capabilities: sections, pages, hover highlight, .fig export, advanced rendering, fill picker, native dialogs, new node types, new tests
- Update VitePress docs to reflect new features: features page, keyboard shortcuts (section tool ✅), file-format (export support), architecture, roadmap, node-types, scene-graph
- No source code changes — specs and docs only

## Capabilities

### New Capabilities

(none — all functionality maps to existing spec domains)

### Modified Capabilities

- `scene-graph`: new node types (CANVAS, ROUNDED_RECTANGLE, COMPONENT, COMPONENT_SET, INSTANCE, CONNECTOR, SHAPE_WITH_TEXT), pages support, sections, hover state
- `canvas-rendering`: tier 1 rendering (gradients, images, effects, stroke cap/join/dash, arcs), hover highlight outline
- `editor-ui`: pages panel, fill type picker (solid/gradient/image tabs, gradient stops), section tool, hover highlight, canvas background color
- `fig-import`: .fig export (Save/Save As), Zstd compression via Tauri Rust, thumbnail generation, browser deflate fallback
- `desktop-app`: Tauri native Save/Open dialogs (plugin-dialog + plugin-fs)
- `selection-manipulation`: section creation with auto-adopt siblings
- `testing`: fig-import unit tests, layout unit tests, layers-panel E2E tests
- `kiwi-codec`: .fig export encoding path
- `vitepress-docs`: update all docs pages to reflect new features

## Impact

- `openspec/specs/` — 9 spec files updated with new requirements/scenarios
- `docs/` — 8+ docs pages updated with new content
- No source code, dependencies, or API changes
