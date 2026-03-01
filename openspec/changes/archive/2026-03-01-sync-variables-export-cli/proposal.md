# Proposal: Sync Variables, Image Export, CLI, Core Extraction

## Why

21 commits merged from master (7ff16f7..d30ab4c) introduce the variables system, image export, monorepo extraction, CLI tooling, and performance improvements.

## What Changes

### Variables (Phase 4 completion)
- Variable, VariableCollection, VariableCollectionMode types
- VariableType: COLOR, FLOAT, STRING, BOOLEAN
- VariableValue with alias support (chain resolution, cycle detection)
- Collections with modes and activeMode switching
- Bind/unbind variables to node properties (fills/strokes colors)
- Renderer resolves variable bindings before painting
- .fig import of VARIABLE NodeChanges and paint variable bindings
- VariablesPanel UI (reka-ui Tabs for collections, Editable for names/values)
- FillSection variable picker (Popover + Combobox), purple badge, detach button
- 7 new unit tests (variables describe block)

### Image Export
- PNG/JPG/WEBP export with scale selector (0.5×–4×) and format picker
- ExportSection in properties panel with live preview and checkerboard background
- Context menu "Export…" action and ⇧⌘E shortcut
- Tauri save dialog / File System Access API / download fallback
- renderThumbnail and renderNodesToImage in render-image.ts
- JPG renders with white background, PNG/WEBP with transparency
- requestRender/requestRepaint split to avoid export preview updates on pan/zoom

### Monorepo & CLI (Phase 5 start)
- @open-pencil/core package extracted to packages/core/ (zero DOM deps)
- @open-pencil/cli package in packages/cli/ with headless CanvasKit CPU
- CLI commands: info, tree, find, export (all support --json)
- Bun workspace structure
- npm publishing preparation

### UI/Performance
- Splash loader during WASM initialization
- CSS containment on side panels
- sceneVersion/renderVersion split for UI panels
- Export preview flicker fix
