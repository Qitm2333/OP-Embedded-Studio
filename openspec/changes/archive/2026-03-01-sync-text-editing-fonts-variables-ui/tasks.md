# Tasks: Sync text editing, system fonts, variables UI

Reference: 19 commits from master (adea7eb..33d3def).
Delta-specs in `openspec/changes/sync-text-editing-fonts-variables-ui/specs/` (text-editing, canvas-rendering, editor-ui, desktop-app, undo-redo).
Proposal: `proposal.md`, Design: `design.md` — validated and aligned with delta-specs.

## 1. Merge Delta-Specs into Main Specs

Each task merges ADDED and MODIFIED requirements from the delta-spec into the baseline. Untouched requirements in the baseline are preserved.

- [x] 1.1 Update `openspec/specs/text-editing/spec.md` — MODIFIED: "Inline text editing" (textarea overlay → canvas-native with phantom textarea), "Font loading" (add Tauri font-kit + preloading). ADDED: "TextEditor class in core", "Font picker component", "Text editing keyboard navigation", "Text selection via mouse drag"
- [x] 1.2 Update `openspec/specs/canvas-rendering/spec.md` — ADDED: "Text editing overlay rendering" (selection rects, blinking caret, blue outline)
- [x] 1.3 Update `openspec/specs/editor-ui/spec.md` — MODIFIED: "Variables panel" → "Variables dialog" (TanStack Table, page properties entry, collection tabs). ADDED: "ColorInput component", "ColorPicker alpha slider checkerboard", "Demo variable collections"
- [x] 1.4 Update `openspec/specs/desktop-app/spec.md` — ADDED: "System font commands via font-kit", "CSS font face registration", "App identity"
- [x] 1.5 Update `openspec/specs/undo-redo/spec.md` — MODIFIED: "All operations undoable" (add variable create/delete/rename, collection create/rename, color/value change)

## 2. Update VitePress Docs

- [x] 2.1 Update `docs/guide/features.md` — rewrite "Inline Text Editing" section (canvas-native, phantom textarea, TextEditor in core, cursor/selection/word boundaries, keyboard navigation with ⌥/⌘ modifiers), add font picker details (virtual scroll, search, CSS preview, font-kit in Tauri). Update Variables section (dialog with TanStack Table, mode columns, collection tabs, undo/redo for variable ops, demo collections with Light/Dark + aliases + spacing). Note: keep anchor `#inline-text-editing` unchanged or add redirect
- [x] 2.2 Update `docs/guide/figma-comparison.md` — specific row changes: "Text tool & inline editing" ✅ update notes (canvas-native, phantom textarea), "Font loading" ✅ update notes (font-kit + preloading in Tauri, queryLocalFonts in browser), "Variables" 🟡 update notes (dialog + TanStack Table + undo/redo + demo collections). Recount ✅/🟡/🔲 totals and update coverage line
- [x] 2.3 Update `docs/development/roadmap.md` — add to Phase 4 Delivered (currently ✅): canvas-native text editing with TextEditor, system font enumeration via font-kit, font picker with virtual scroll, variables dialog redesign (TanStack Table), variable undo/redo, ColorInput extraction, app icon and identity

## 3. Verify

- [x] 3.1 Run `bun run docs:build` — verify VitePress build passes, check no broken anchor warnings in output
