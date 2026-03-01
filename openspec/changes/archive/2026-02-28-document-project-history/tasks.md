## 1. Validate artifacts

- [x] 1.1 Run `openspec status --change document-project-history` to confirm all artifacts (proposal, design, specs, tasks) are done
- [x] 1.2 Verify all 19 spec directories exist in `changes/document-project-history/specs/`: scene-graph, canvas-rendering, canvas-navigation, selection-manipulation, undo-redo, text-editing, pen-tool, auto-layout, figma-clipboard, fig-import, kiwi-codec, editor-ui, snap-guides, rulers, group-ungroup, desktop-app, testing, scrub-input, tooling

## 2. Archive and merge

- [x] 2.1 Run `openspec archive --change document-project-history` to merge delta specs into `openspec/specs/` and move the change to archive
- [x] 2.2 Verify all 19 spec directories now exist in `openspec/specs/` with their `spec.md` files
- [x] 2.3 Verify the change was moved to `openspec/changes/archive/document-project-history/`
