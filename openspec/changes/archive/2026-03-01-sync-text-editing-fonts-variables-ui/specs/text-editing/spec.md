# text-editing Specification (delta)

## Modified Requirements

### Requirement: Inline text editing (MODIFIED)
Double-clicking a text node SHALL enter canvas-native inline editing mode. A hidden phantom textarea (positioned off-screen, opacity 0) SHALL capture keyboard input, IME composition, and clipboard events. The canvas SHALL render the text directly using CanvasKit Paragraph API — no visible textarea overlay.

#### Scenario: Enter edit mode
- **WHEN** user double-clicks a text node
- **THEN** a phantom textarea is created off-screen and focused, the canvas renders text with a blinking caret

#### Scenario: IME composition
- **WHEN** user enters IME composition during text editing
- **THEN** the phantom textarea handles compositionstart/compositionend events and the composed text is inserted into the TextEditor

### Requirement: Font loading (MODIFIED)
The editor SHALL load Inter as the default font. In Tauri, system fonts SHALL be enumerated and loaded via Rust commands (list_system_fonts, load_system_font) using the font-kit crate. In browser, the Local Font Access API SHALL be used when available. Font list SHALL be preloaded on app startup (cached via OnceLock in Rust) so the picker is ready instantly.

#### Scenario: Default font
- **WHEN** a text node is created without specifying a font
- **THEN** the Inter font is used for rendering

#### Scenario: System fonts via Tauri
- **WHEN** the app runs as a Tauri desktop app
- **THEN** system fonts are enumerated via the font-kit Rust command and loaded via invoke()

#### Scenario: System fonts via browser
- **WHEN** the app runs in a browser with Local Font Access API
- **THEN** system fonts are enumerated via queryLocalFonts

#### Scenario: Font preloading
- **WHEN** the app starts
- **THEN** the font list is preloaded so the font picker opens without delay

## New Requirements

### Requirement: TextEditor class in core
A TextEditor class SHALL live in packages/core/src/text-editor.ts providing cursor positioning, text selection, word boundary detection, and line navigation using CanvasKit Paragraph API (getGlyphPositionAtCoordinate, getRectsForRange, getLineMetrics). It SHALL support: insert, backspace, delete, select all, select word, move left/right/up/down, move to line start/end, move word left/right, and extend selection with Shift.

#### Scenario: Cursor positioning
- **WHEN** user clicks inside a text node during editing
- **THEN** the cursor moves to the glyph position nearest to the click coordinates

#### Scenario: Word selection
- **WHEN** user double-clicks a word during text editing
- **THEN** the word is selected (from word boundary to word boundary)

#### Scenario: Line navigation
- **WHEN** user presses ⌘← during text editing
- **THEN** the cursor moves to the start of the current line

### Requirement: Font picker component
A FontPicker component SHALL provide font family selection with: reka-ui Listbox with virtual scroll (ListboxVirtualizer), search filter (ListboxFilter), CSS font preview (each row rendered in the font itself), and scroll-to-current behavior. Font faces are registered for CSS preview via registerFontFaces.

#### Scenario: Font picker search
- **WHEN** user types "Mono" in the font picker search
- **THEN** only font families containing "Mono" are shown

#### Scenario: Font preview
- **WHEN** user opens the font picker
- **THEN** each font family name is displayed in its own font face

### Requirement: Text editing keyboard navigation
The phantom textarea SHALL handle keyboard navigation with modifier support: ⌥← / ⌥→ (word movement), ⌘← / ⌘→ (line start/end), ⌘⌫ (delete to line start), ⌥⌫ (delete word), Shift extends selection for all movement keys. Cut (⌘X), Copy (⌘C), Paste (⌘V) SHALL use navigator.clipboard API.

#### Scenario: Word-level backspace
- **WHEN** user presses ⌥⌫ during text editing
- **THEN** the word before the cursor is deleted

#### Scenario: Copy selection
- **WHEN** user selects text and presses ⌘C
- **THEN** the selected text is copied to the clipboard

### Requirement: Text selection via mouse drag
Clicking inside a text node during editing SHALL position the cursor. Dragging SHALL extend the selection. Clicking outside the text node bounds SHALL commit the edit and exit editing mode.

#### Scenario: Drag to select
- **WHEN** user clicks and drags inside a text node during editing
- **THEN** the text between click start and current position is selected

#### Scenario: Click outside commits
- **WHEN** user clicks outside the editing text node
- **THEN** the text edit is committed and editing mode exits
