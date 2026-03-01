# Proposal: Sync text editing, system fonts, variables UI

## Why
19 commits merged from master (adea7eb..33d3def) introduce three major feature areas that need specs, docs, and comparison matrix updates.

## What changed

### Canvas-native text editing (33d3def)
- TextEditor class in packages/core/src/text-editor.ts — cursor, selection, word boundaries, line navigation via CanvasKit Paragraph API (getGlyphPositionAtCoordinate, getRectsForRange)
- Renderer draws selection highlights (blue translucent rects) and blinking caret directly on canvas
- Phantom textarea (hidden off-screen) captures input, IME composition, clipboard, arrow keys, Home/End, word/line movement (⌥/⌘ modifiers)
- Replaces old visible textarea overlay approach
- use-text-edit.ts composable handles input/composition/clipboard/keyboard
- use-canvas-input.ts adds text selection drag + double-click word select
- editor.ts reworked startTextEditing/commitTextEdit to use TextEditor

### System font enumeration via font-kit (5ccae70, 326f5d1, 621e38e, 4e03d26)
- Rust: list_system_fonts and load_system_font Tauri commands using font-kit crate
- OnceLock cache in Rust for font list, preloaded on app startup
- TS font shim: Tauri path uses invoke() vs browser queryLocalFonts
- FontPicker component: reka-ui Listbox + PopoverRoot with virtual scroll, search filter, CSS font preview via registerFontFaces
- Extracted from TypographySection into standalone FontPicker.vue

### Variables dialog redesign (5c4c6d7 → 2054436, 10 commits)
- VariablesPanel → VariablesDialog (reka-ui Dialog + Tabs + Editable)
- VariablesSection in page properties panel (settings icon opens dialog)
- TanStack Table (@tanstack/vue-table) with resizable columns
- Table layout matches Figma: Name | Mode 1 | Mode 2 | ...
- ColorInput component extracted (swatch + hex, replaces duplication in PageSection, StrokeSection, EffectsSection, VariablesDialog)
- ColorPicker: alpha slider checkerboard fix
- Undo/redo for all variable operations (create/delete variable, create collection, rename, color change)
- Demo: 3 collections (Primitives Light/Dark, Semantic aliases, Spacing Default/Compact)
- Double-click to rename collection tabs

### Desktop app polish (88765bd, faf7ba6, f7d1d59)
- Pencil loader icon as Tauri app icon
- Cargo crate renamed to open_pencil, binary to OpenPencil
- macOS Dock name fix: open-pencil-app → OpenPencil
