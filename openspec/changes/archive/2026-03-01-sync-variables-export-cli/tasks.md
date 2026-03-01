# Tasks: Sync Variables, Image Export, CLI, Core Extraction

Reference: 21 commits from master (7ff16f7..d30ab4c).
Delta-specs: `openspec/changes/sync-variables-export-cli/specs/` (scene-graph, editor-ui, canvas-rendering, desktop-app, tooling, testing, cli).

Section 1 (specs) must be completed before Section 2 (docs) to ensure docs reference finalized specs.

## 1. Merge Delta-Specs into Main Specs

- [x] 1.1 Update `openspec/specs/scene-graph/spec.md` — add Variable/VariableCollection/VariableCollectionMode types, VariableType (COLOR/FLOAT/STRING/BOOLEAN), VariableValue with alias support, alias chain resolution with cycle detection, collections with modes and activeMode switching, bind/unbind variables to node properties, removal cleans up bindings.
- [x] 1.2 Update `openspec/specs/editor-ui/spec.md` — add VariablesPanel (reka-ui Tabs for collections, Editable for names/values, toggle from layers sidebar), FillSection variable picker (Popover/Combobox, purple badge, detach button), ExportSection (scale 0.5×–4×, format PNG/JPG/WEBP, live preview with checkerboard, multi-export, JPG white bg, PNG/WEBP transparency), ⇧⌘E export shortcut, context menu "Export…", splash loader during WASM init.
- [x] 1.3 Update `openspec/specs/canvas-rendering/spec.md` — add variable binding resolution before painting, image export rendering (offscreen surface, scale, JPG opaque/PNG-WEBP transparent, OffscreenCanvas re-encoding), sceneVersion vs renderVersion split (prevents export preview flicker on pan/zoom).
- [x] 1.4 Update `openspec/specs/desktop-app/spec.md` — add monorepo structure with @open-pencil/core extracted to packages/core/ (zero DOM deps, re-export shims in src/engine/).
- [x] 1.5 Create `openspec/specs/cli/spec.md` — new spec domain for @open-pencil/cli: headless .fig operations (info, tree, find, export), CanvasKit CPU rasterization, --json output.
- [x] 1.6 Update `openspec/specs/tooling/spec.md` — update to Bun workspace monorepo (root + packages/core + packages/cli), add npm publishing preparation.
- [x] 1.7 Update `openspec/specs/testing/spec.md` — add variable system unit tests (7 tests covering color/number resolve, alias chain, circular alias, mode switching, bind/unbind, removal cleanup).

## 2. Update VitePress Docs

- [x] 2.1 Update `docs/guide/features.md` — add "Variables" section (COLOR type with collections, modes, bindings, VariablesPanel, variable picker in FillSection). Add "Image Export" section (PNG/JPG/WEBP, scale selector, ⇧⌘E, context menu). Add "@open-pencil/core & CLI" section (monorepo, headless CLI commands). Update Properties Panel section list to include Export.
- [x] 2.2 Update `docs/guide/figma-comparison.md`:
  - Variables (color, number, string, boolean): 🔲→🟡 (COLOR fully implemented with UI; FLOAT/STRING/BOOLEAN types defined but no UI)
  - Variable collections & modes: 🔲→🟡 (collections, modes, activeMode work; no variable-driven theming UI yet)
  - Image/SVG export: 🔲→🟡 (PNG/JPG/WEBP with scale done; SVG/PDF not yet)
  - Add row: CLI tools | 🟡 | info, tree, find, export commands; MCP server not yet
  - Update coverage count and date
- [x] 2.3 Update `docs/development/roadmap.md` — add variables (COLOR with UI, bindings, .fig import), image export (PNG/JPG/WEBP + ExportSection), splash loader to Phase 4 Delivered. Add @open-pencil/core extraction and @open-pencil/cli to Phase 5 Delivered. Update Phase 5 Planned to remove items now delivered.
- [x] 2.4 Update `docs/reference/keyboard-shortcuts.md` — add ⇧⌘E (Export…) to File section.
- [x] 2.5 Update `docs/development/contributing.md` — update project structure tree to include packages/core/ and packages/cli/.

## 3. Verify

- [x] 3.1 Run `bun run docs:build` to verify VitePress build passes.
