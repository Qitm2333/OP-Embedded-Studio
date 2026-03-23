# @open-pencil/vue SDK Redesign Plan

Goal: Reka UI-style headless components for building editors like OpenPencil.
OpenPencil app becomes a styled composition of these primitives.

## Principles

1. Every app component maps to an SDK headless primitive
2. Reka UI naming: `XxxRoot`, `XxxItem`, `XxxTrigger` with `v-slot`
3. No app opinions — no icons, cursors, toast, constants, styling
4. Composable over component when headless (no DOM = composable)
5. App = styled SDK composition

## SDK Component Inventory

### Canvas

| SDK | Type | Slot props / API |
|-----|------|-----------------|
| `CanvasRoot` | Component | Provides editor context + canvas lifecycle |
| `CanvasSurface` | Component | `<canvas>` with render loop, `@ready` event |
| `useCanvasInput()` | Composable | Mouse/touch/gesture, cursor override |
| `usePanZoom()` | Composable | Wheel, pinch, pan |
| `useTextEdit()` | Composable | Text editing, IME, caret |
| `useCanvasDrop()` | Composable | File drag-and-drop |

### Layers

| SDK | Type | Slot props |
|-----|------|-----------|
| `LayerTreeRoot` | Component | Tree data, expand/collapse, selection |
| `LayerTreeItem` | Component | DnD, rename, visibility, lock per row |

### Pages

| SDK | Type | Slot props |
|-----|------|-----------|
| `PageList` | Component | pages, currentPageId, switchPage, addPage, deletePage |

### Toolbar

| SDK | Type | Slot props |
|-----|------|-----------|
| `ToolbarRoot` | Component | activeTool, tools, flyouts |
| `ToolbarItem` | Component | active state, select handler |

### Properties

| SDK | Type | Slot props |
|-----|------|-----------|
| `useNodeProps()` | Composable | Selection-aware property editing with undo |
| `PositionControls` | Component | x, y, w, h, rotation, alignment actions |
| `FillControlsRoot` | Component | fill CRUD, variable binding helpers |
| `StrokeControlsRoot` | Component | stroke align/side/weight helpers |
| `EffectsControlsRoot` | Component | effect defaults, scrub/commit helpers |
| `AppearanceControlsRoot` | Component | corner radius, opacity, visibility helpers |
| `TypographyControlsRoot` | Component | font family/weight/size, alignment, decoration helpers |
| `LayoutControlsRoot` | Component | auto-layout/grid, sizing, padding, alignment helpers |
| `ExportControls` | Component | Format/scale, export trigger |
| `PageControls` | Component | Page background color |
| `VariablesIndicator` | Component | Variable count |

### Color

| SDK | Type | Slot props |
|-----|------|-----------|
| `FillPickerRoot` | Component | Fill type tabs, delegates to sub-pickers |
| `GradientEditorRoot` | Component | Stops, subtype |
| `GradientEditorBar` | Component | Draggable stop bar |
| `GradientEditorStop` | Component | Single stop |
| `ImageFillControls` | Component | Preview, file picker, scale mode |
| `ColorPickerRoot` | Component | Color popover |
| `ColorInput` | Component | Swatch + hex |

### Variables

| SDK | Type | Slot props |
|-----|------|-----------|
| `VariablesEditorRoot` | Component | collections, active tab/search state, table instance, collection actions |

### Menus

| SDK | Type | Slot props |
|-----|------|-----------|
| `useEditorCommands()` | Composable | Typed command registry, enablement, run helpers |
| `useMenuModel()` | Composable | Renderless menu trees for app/context/mobile menus |
| `EditorContextMenu` | Component | Optional thin renderer over `useMenuModel().canvasMenu` |
| `EditorMenuBar` | Component | Optional thin renderer over `useMenuModel().appMenu` |

### Inputs

| SDK | Type | Slot props |
|-----|------|-----------|
| `ScrubInput` | Component | Drag-to-change number input |
| `FontPickerRoot` | Component | Font family combobox behavior + slots |

### Composables (existing, keep)

| SDK | Purpose |
|-----|---------|
| `useEditor()` | Inject editor |
| `useSelectionState()` | Reactive selection queries |
| `useSelectionCapabilities()` | Selection-aware command enablement |
| `useEditorCommands()` | Shared command execution layer |
| `useMenuModel()` | Renderless menu data model |
| `useViewportKind()` | Shared mobile/desktop breakpoint state |
| `useNodeProps()` | Property editing with undo |
| `useInlineRename()` | Inline rename input |
| `useLayerDrag()` | Atlaskit tree DnD |
| `useFontStatus()` | Font loading state |

## NOT in SDK (app-specific)

- `chat/` (6 files) — AI providers, ACP
- `CollabPanel` — P2P/Yjs
- `MobileHud`, `MobileDrawer` — app mobile layout
- `SafariBanner` — browser detection
- `TabBar` — multi-tab files
- `AppToast` — toast styling
- `CodePanel` — JSX generation
- `use-collab.ts`, `use-chat.ts`, `use-keyboard.ts`, `use-menu.ts`
- app-styled UI primitives in `src/components/ui/` (`AppSelect`, `AppGroupedSelect`, `Tip`, style helpers) stay outside SDK unless rewritten as headless/generic primitives

## Migration Phases

### Phase 1: Establish pattern (3 exemplars)
- `ScrubInput` — pure UI, no editor dep
- `PageList` — clean up existing
- `ToolbarRoot`/`ToolbarItem` — headless tool selector

### Phase 2: Canvas primitives
- `CanvasRoot`/`CanvasSurface`
- Clean `useCanvasInput`, `usePanZoom`, `useTextEdit`, `useCanvasDrop`

### Phase 3: Property primitives
- ✅ `FillControlsRoot`, `StrokeControlsRoot`, `EffectsControlsRoot`
- ✅ `PositionControlsRoot`, `AppearanceControlsRoot`, `TypographyControlsRoot`, `LayoutControlsRoot`
- ✅ `FontPickerRoot`
- Next: tighten slot APIs and decide whether `ColorInput` / richer fill picker pieces belong in SDK

### Phase 4: Layer tree primitives
- `LayerTreeRoot`/`LayerTreeItem` with Atlaskit DnD
- Rename, selection sync

### Phase 5: Menu primitives
- ✅ `useEditorCommands()`
- ✅ `useMenuModel()`
- Next: optional `EditorContextMenu`, `EditorMenuBar` renderers once app-side host overrides settle

### Phase 6: Dialog/picker primitives
- ✅ `VariablesEditorRoot`
- `FillPickerRoot`, `GradientEditorRoot`, `ImageFillControls`
- `ExportControls`

### Phase 7: App migration
- Rewrite every app component as styled SDK composition
- App files = styling + layout only

## Current status

Completed:
- `useSelectionCapabilities()`
- `useEditorCommands()`
- `useViewportKind()`
- `useMenuModel()`
- `FontPickerRoot`
- `PageListRoot`
- `PositionControlsRoot`
- `TypographyControlsRoot`
- `AppearanceControlsRoot`
- `LayoutControlsRoot`
- `FillControlsRoot`
- `StrokeControlsRoot`
- `EffectsControlsRoot`
- `VariablesEditorRoot`
- `CanvasMenu.vue` partly rendered from SDK menu model
- `AppMenu.vue` partly rendered from SDK menu model
- keyboard shortcuts migrated to shared command execution for core editor actions

Next recommended steps:
1. Tighten SDK slot APIs to avoid broad "ctx dump" slot objects where possible
2. Continue peeling reusable editor logic from root components into shared composables (`useVariablesEditor`, fill/effect/stroke helpers, etc.)
3. Decide whether `ColorInput`, `FillPickerRoot`, and image/gradient subcontrols should move into SDK next
4. Standardize remaining app primitives on the `ui` + `useComponentUI()` pattern, preferring semantic slot overrides over raw class props
5. Continue moving app-styled reusable components into `src/components/ui/`
6. Normalize slot-based style helpers (`menu`, `dialog`, `popover`, `tooltip`, `select`) around the same override conventions
7. Move remaining `MobileHud` menu/action groups behind command/menu abstractions
8. Decide whether `EditorContextMenu` / `EditorMenuBar` should exist as SDK renderers or stay as app renderers over SDK data
