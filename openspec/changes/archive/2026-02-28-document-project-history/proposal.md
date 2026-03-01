## Why

OpenPencil has 92 commits of implementation history and a comprehensive PLAN.md, but no structured specification tracking. The openspec/ directory is empty. To enable spec-driven development going forward, we need to retroactively document all completed work as baseline specs and capture the planned-but-not-yet-implemented capabilities from PLAN.md. This establishes the source of truth for what the system does today and what's next.

Additionally, we need to assess the current state of documentation tooling — specifically whether VitePress documentation generation has any existing artifacts or setup in the project.

## What Changes

- Create baseline openspec specs from the 92 git commits covering all implemented capabilities
- Document planned capabilities from PLAN.md phases that are not yet implemented
- Assess VitePress documentation generation readiness (no implementation — evaluation only)

## Capabilities

### New Capabilities

- `scene-graph`: Core scene graph with flat Map<GUID, Node> storage, parent-child tree via parentIndex, CRUD operations, hit testing, node types (FRAME, RECTANGLE, ELLIPSE, LINE, TEXT, VECTOR, STAR, POLYGON, GROUP, BOOLEAN_OPERATION)
- `canvas-rendering`: Skia CanvasKit WASM rendering — shapes, fills, strokes, text, effects, transforms, nested coordinate systems, selection outlines, snap guides, rulers
- `canvas-navigation`: Pan (space+drag, middle mouse, trackpad), zoom (ctrl+scroll, pinch, keyboard shortcuts), zoom-to-fit, pixel grid
- `selection-manipulation`: Click select, shift-click multi-select, marquee selection, move with drag, resize handles, rotation with 15° snap, duplicate (alt+drag, ⌘D), delete, nudge with arrows
- `undo-redo`: Inverse-command pattern undo/redo wired into all editor operations
- `text-editing`: Inline text editing with CanvasKit Paragraph API, textarea overlay, font loading (Inter default + Local Font Access API for system fonts), font weight, auto-width text boxes
- `pen-tool`: Pen tool with vector network model, bezier curves, open/closed paths, vectorNetworkBlob binary encode/decode
- `auto-layout`: Yoga WASM integration, horizontal/vertical/wrap, gap, padding, justify, align, child sizing, Shift+A toggle, drag reordering with insertion indicator, wrap selected nodes in auto-layout
- `figma-clipboard`: Bidirectional Figma clipboard — paste from Figma (fig-kiwi binary decode), copy for Figma (fig-kiwi binary encode), cut/copy between OpenPencil instances
- `fig-import`: .fig file import via Kiwi codec — header parsing, Zstd decompression, schema decode, NodeChange[] extraction, scene graph population
- `kiwi-codec`: Vendored kiwi-schema, Kiwi binary codec for Figma's 194-definition schema, ESM/CLI patching for sparse field IDs
- `editor-ui`: Vue 3 + Reka UI panels — toolbar (bottom), layers panel (tree with expand/collapse, drag reorder, visibility toggle), properties panel (appearance, fill, stroke, typography, layout, position sections), color picker (HSV, hex, opacity, alpha)
- `snap-guides`: Edge and center snapping, rotation-aware snap guides and selection bounds, sibling-based absolute coordinate snapping
- `rulers`: Canvas rulers with selection highlight, coordinate badges at selection start/end, tick label alignment, ?no-rulers URL param
- `group-ungroup`: Group/ungroup selection (⌘G / ⇧⌘G), sort nodes by position when wrapping
- `desktop-app`: Tauri v2 shell with native macOS menu bar, menu events wired to frontend, Developer Tools menu item
- `testing`: Playwright visual regression (E2E with Figma CDP reference), bun:test unit tests for SceneGraph, no-chrome test mode, data-ready optimization
- `scrub-input`: ScrubInput component — drag-to-scrub values, click-to-edit, suffix styling, used across all numeric property inputs
- `tooling`: oxlint, oxfmt, typescript-go, Vite 7, Tailwind CSS 4, unplugin-icons (Lucide via Iconify)

### Modified Capabilities

_(none — this is the initial baseline)_

## Impact

- `openspec/specs/` — populated with ~19 baseline spec files documenting current state
- `openspec/specs/` — additional specs for planned capabilities from PLAN.md marked as "planned"
- No source code changes — this is a documentation-only change
- Assessment report on VitePress readiness included in the specs
