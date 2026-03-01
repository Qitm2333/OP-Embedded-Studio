## 1. Update Features Documentation

- [x] 1.1 Add "Components & Instances" section to `docs/guide/features.md` (create component ⌥⌘K, component sets ⇧⌘K, create instance, detach ⌥⌘B, go to main, purple labels, opaque container selection)
- [x] 1.2 Add "Context Menu" section to `docs/guide/features.md` (right-click actions: clipboard, z-order, group, component, visibility, lock, move-to-page)
- [x] 1.3 Add "Z-Order, Visibility & Lock" section to `docs/guide/features.md` (] bring to front, [ send to back, ⇧⌘H visibility toggle, ⇧⌘L lock toggle, move to page via context menu)
- [x] 1.4 Add rendering optimizations note to `docs/guide/features.md` (viewport culling, Paint reuse, RAF coalescing — brief, under existing Advanced Rendering section)

## 2. Update Keyboard Shortcuts

- [x] 2.1 Update `docs/reference/keyboard-shortcuts.md` — mark implemented: ⌥⌘K (Create Component ✅), ⌥⌘B (Detach Instance ✅), ⇧⌘K (Create Component Set — add new row ✅), ] (Bring to Front ✅), [ (Send to Back ✅); add new rows: ⇧⌘H (Toggle Visibility ✅), ⇧⌘L (Toggle Lock ✅)

## 3. Update Roadmap

- [x] 3.1 Update `docs/development/roadmap.md` — Phase 4 from 🔲 to 🟡 In Progress, list delivered: component creation/instantiation, component sets, detach, go-to-main, component labels, context menu

## 4. Update Figma Feature Matrix

- [x] 4.1 Update `docs/guide/figma-comparison.md` — Components & Design Systems table: create components 🟡 (basic creation works, no overrides propagation), component instances 🟡 (create/detach works, no override editing), detach instance 🟡; Layers & Shapes table: lock/unlock ✅, rename layers 🟡 (programmatic via store, no inline UI yet); add new rows: "Bring to front / Send to back" ✅ in Layers & Shapes, "Context menu" ✅ in Interface & Navigation; update coverage count in header

## 5. Verify

- [x] 5.1 Run `bun run docs:build` to confirm all pages build without errors
