# Refactoring Roadmap

Comprehensive audit of vibe-coding leftovers and structural debt.

## 🔴 Critical (Architectural Debt)

### 1. `src/stores/editor.ts` — 2,505 lines, the God Store

One closure captures ~30 mutable `let` variables and exposes ~80 methods covering: file I/O, undo, pen tool, layout, selection, export, import, clipboard, images, paging, zooming, autosave, file watching, component ops, text editing.

**Refactoring:** Extract `createEditor()` to `packages/core/src/editor/` folder with domain modules sharing an `EditorContext` interface. App store becomes a thin Vue wrapper.

**Status:** ✅ Done — 13 modules, largest 394 lines. App store: 747 lines.

### 2. `src/composables/use-canvas-input.ts` — 1,501 lines, the Input Monolith

Handles 8 drag types, touch/gesture, wheel zoom, double-click, hit testing, snap guides, auto-layout indicators, reparenting, and hover cursors — all in one function.

**Status:** ✅ Done — split into 5 modules in `packages/vue/src/input/`:
- `types.ts` (88) — DragState variants, HandlePosition, TOOL_TO_NODE
- `geometry.ts` (170) — hit testing, handle positions, rotation cursor
- `pan-zoom.ts` (266) — wheel, touch pinch, Safari gestures
- `resize.ts` (121) — constrainToAspectRatio, applyResize
- `auto-layout.ts` (103) — insert indicator computation
- Orchestrator `use-canvas-input.ts` reduced to 817 lines

### 3. State is fully mutable to all consumers

`editor.state` is a raw `shallowReactive` — every composable mutates it freely (`store.state.panX = ...`, `store.state.zoom = ...`). Zero uses of `readonly`/`shallowReadonly` anywhere.

**Refactoring:** Expose `shallowReadonly(state)` as the public API, add explicit setter methods for mutations that need to happen from outside the store.

## 🟡 Medium (Code Quality)

### 4. Fire-and-forget async calls — 10+ unhandled

Multiple `void asyncFn()` calls where rejections are silently swallowed:
- `void switchPage()` in `addPage`/`deletePage`
- `void reloadFromDisk()` in file watcher
- `void loadFontsForNodes()` in paste handler
- `saveFigFile`, `writeFile`, `reloadFromDisk` — no try/catch, silent data loss risk

**Refactoring:** Wrap fire-and-forget calls in a `safeFire(promise, context)` helper that catches and shows a toast. Add try/catch to all async store methods.

### 5. Module-level state in composables

`use-chat.ts` declares all state (`providerID`, `apiKey`, `modelID`, etc.) at module scope outside the composable function. `use-menu.ts` calls `useFileDialog()` and `useEditorStore()` at module scope — technically incorrect for VueUse composables that expect `setup()` context.

**Refactoring:** Move state inside the composable function or convert `use-chat.ts` to a proper store. Move `useFileDialog()` inside the exported function.

### 6. Bounding-box computation duplicated ~10 times

The `let minX = Infinity; ... Math.min/max` pattern appears in `editor.ts` (7×), `tools/read.ts`, `tools/vector.ts`, `clipboard.ts`, `renderer/overlays.ts`, `figma-api.ts`.

**Refactoring:** Add a generic `computeBounds(items, getRect): Rect` to `geometry.ts`, replace all copies.

### 7. "Node not found" guard repeated 44 times in tools

Every tool function starts with `const node = figma.getNodeById(id); if (!node) return { error: ... }`.

**Refactoring:** Add `requireNode(figma, id)` to `tools/schema.ts` that either returns the node or throws a typed error caught by the tool executor.

### 8. Barrel import overuse — 58 consumers use `@open-pencil/core` vs 2 using subpaths

Subpath exports (`/scene-graph`, `/tools`, `/renderer`, etc.) exist but are almost unused. The barrel `export * from './constants'` dumps 91 exports.

**Refactoring:** Migrate app imports to use subpath exports. Improves tree-shaking and makes dependency intent explicit.

### 9. `kiwi-serialize.ts` misplaced

495-line file at the core root that imports exclusively from `./kiwi/*`. Belongs inside `kiwi/`.

**Refactoring:** Move to `packages/core/src/kiwi/kiwi-serialize.ts`, update imports.

### 10. `tools/stock-photo.ts` throws instead of returning `{ error }`

All other tools return `{ error: string }` for AI consumers, but `stock-photo.ts` throws.

**Refactoring:** Change to return `{ error }` like all other tools.

## 🟢 Low Priority (Polish)

### 11. Large Vue components (8 over 300 lines)

| Lines | Component | Split into |
|-------|-----------|-----------|
| 553 | `VariablesDialog.vue` | `VariablesTable` + `VariableCell` + dialog wrapper |
| 537 | `LayoutSection.vue` | auto-layout vs absolute sections |
| 504 | `FillPicker.vue` | extract `GradientEditor` |
| 503 | `LayerTree.vue` | extract drag-to-reparent composable |
| 388 | `Toolbar.vue` | extract action menu sub-components |
| 382 | `StrokeSection.vue` | extract shared paint picker with FillSection |
| 337 | `NodeContextMenuContent.vue` | group into sub-menus |
| 314 | `ProviderSettings.vue` | extract per-provider form components |

### 12. Icon import bloat

`Toolbar.vue` (14 icon imports), `LayerTree.vue` (13), `MobileHud.vue` (5). Extract icon maps to shared utils.

### 13. Unscoped `<style>` in `CodePanel.vue`

8 `.token.*` rules leak globally. Scope or move to `app.css`.

### 14. Dead exports (7 functions)

- `copyFill`, `copyStroke`, `copyEffect`, `copyStyleRun` in `copy.ts` (only array variants used)
- `createPropertyChange` in `undo.ts`
- `designTokens` in `tools/codegen.ts`
- `queryFonts` in `fonts.ts`

### 15. Renderer circular imports

`renderer.ts` ↔ `ai-overlays.ts` and `renderer.ts` ↔ `rulers.ts` — runtime cycles through type + value imports. Extract a `SkiaRendererContext` interface to break the cycle.

### 16. Duplicate font weight maps

Weight-to-name mapping exists in both `figma-api-proxy.ts` and `fonts.ts`. Extract to a shared constant.

### 17. Rotated corners reimplemented

`renderer/overlays.ts` and `snap.ts` reimplement `rotatedCorners()` instead of importing from `geometry.ts`.

### 18. Duplicate .fig scaffold/zip assembly

Same DOCUMENT NodeChange in `clipboard.ts` and `fig-export.ts`. Same zip structure in `fig-export-worker.ts` and `fig-export.ts`.

### 19. Group/Frame/Component/ComponentSet creation — 4× copy-paste

Lines ~1215, ~1295, ~1390, ~1460 in editor.ts each follow the identical 50-line pattern: compute bbox → calculate parent offset → find z-index → create container → reparent children → push undo. Only the node type and a few props differ. ~200 lines that should be `wrapSelectionInContainer(type, extraProps)`.

### 20. `console.warn`/`console.error` (30 total)

All legitimate error handlers but would benefit from a structured logger. The bare `console.error(e)` in `EditorView.vue:67` should add context.

---

## Editor Folder Split Plan

Target: `packages/core/src/editor/`

```
packages/core/src/editor/
├── index.ts              # re-export createEditor, types, constants
├── types.ts              # EditorState, EditorOptions, Tool, EditorToolDef
├── context.ts            # EditorContext interface (shared deps all modules access)
├── create.ts             # createEditor() assembler
├── viewport.ts           # screenToCanvas, applyZoom, pan, zoomToBounds/Fit/100/Selection
├── selection.ts          # select, clearSelection, selectAll, setMarquee, setSnapGuides, ...
├── pages.ts              # switchPage, addPage, deletePage, renamePage, pageViewports
├── shapes.ts             # createShape, adoptNodesIntoSection, pen*, vector bounds
├── structure.ts          # group, ungroup, wrapInAutoLayout, reorder, reparent, bringToFront/sendToBack
├── components.ts         # createComponent, componentSet, createInstance, detach, goToMain, sync
├── clipboard.ts          # duplicateSelected, writeCopyData, pasteFromHTML, deleteSelected
├── undo.ts               # commitMove/Resize/Rotation/NodeUpdate, undo/redo, snapshot
├── text.ts               # startTextEditing, commitTextEdit
└── nodes.ts              # updateNode, updateNodeWithUndo, setLayoutMode, visibility/lock, rename, moveToPage
```

Each module exports a factory: `createXxxActions(ctx: EditorContext) => { ... }`.
`create.ts` assembles context + all modules, spreads into a flat return object.
`Editor` type = `ReturnType<typeof createEditor>` — unchanged for all consumers.
