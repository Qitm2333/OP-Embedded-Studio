## 1. Update VitePress docs — Features page

- [x] 1.1 Add Sections feature to features.md (SECTION node, title pills, auto-adopt, top-level-only)
- [x] 1.2 Add Multi-page support to features.md (pages panel, add/delete/rename, per-page viewport)
- [x] 1.3 Add .fig Export to features.md (Save/Save As, Kiwi encode, Zstd, thumbnail)
- [x] 1.4 Add Hover Highlight to features.md (shape-aware outlines)
- [x] 1.5 Update existing features with advanced rendering (gradients, image fills, effects, stroke cap/join/dash, arcs)

## 2. Update VitePress docs — Reference pages

- [x] 2.1 Update node-types.md: change NodeType union to 17 types, update type table to match actual scene graph
- [x] 2.2 Update file-format.md: add .fig export section, update formats table (.fig export ✅)
- [x] 2.3 Update keyboard-shortcuts.md: mark S (Section) ✅, add ⌘S (Save) ✅ and ⇧⌘S (Save As) ✅ to File section
- [x] 2.4 Update scene-graph.md: add pages, sections, hover state, extended fill/stroke types

## 3. Update VitePress docs — Other pages

- [x] 3.1 Update architecture.md: add .fig export to file format layer, remove .openpencil reference, add pages panel to navigation
- [x] 3.2 Update roadmap.md: move sections, pages, hover, .fig export, advanced rendering to delivered
- [x] 3.3 Update testing.md: add fig-import unit tests, layout unit tests, layers-panel E2E tests

## 4. Update landing page

- [x] 4.1 Update index.md hero features to reflect new capabilities (sections, pages, .fig export, advanced rendering)

## 5. Verify

- [x] 5.1 Run docs:build and verify no broken links or build errors
- [x] 5.2 Validate task completion — all docs pages reflect current implementation state
