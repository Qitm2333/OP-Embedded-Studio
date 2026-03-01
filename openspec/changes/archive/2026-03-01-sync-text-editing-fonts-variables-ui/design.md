# Design: Sync text editing, system fonts, variables UI

## Approach
Documentation-only change. Update delta-specs for affected domains, then propagate to VitePress docs and comparison matrix.

## Affected spec domains

1. **text-editing** — major rewrite: textarea overlay → canvas-native editing with phantom textarea, TextEditor class in core, selection/caret rendering
2. **editor-ui** — VariablesPanel → VariablesDialog (TanStack Table, page properties entry point), FontPicker component, ColorInput extraction
3. **canvas-rendering** — text selection highlights and blinking caret drawn on canvas during editing
4. **desktop-app** — font-kit system font commands (list_system_fonts, load_system_font), app icon/name fixes
5. **undo-redo** — variable operations now undoable (create/delete/rename variable, create collection, rename collection, change color/value)
6. **scene-graph** — demo variable collections (primitives, semantic, spacing) validate multi-mode and alias features

## VitePress docs updates
- features.md: rewrite text editing section (canvas-native), add font picker details, update variables UI description
- figma-comparison.md: update Text tool row (canvas-native), Font loading (font-kit Tauri), Variables → more complete status
- roadmap.md: add text editing and fonts to Phase 4 delivered
- keyboard-shortcuts.md: no new shortcuts (existing ones still apply)

## Risks
- None — documentation only, no source changes
