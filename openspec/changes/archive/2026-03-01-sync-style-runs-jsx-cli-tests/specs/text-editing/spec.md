# text-editing Specification (delta)

## New Requirements

### Requirement: Rich text style runs
Text nodes SHALL support per-character formatting via StyleRun arrays: `{start, length, style}` where style includes fontWeight, italic (boolean), and textDecoration (UNDERLINE, STRIKETHROUGH). ⌘B toggles bold, ⌘I toggles italic, ⌘U toggles underline on the current selection. With no selection, the shortcut toggles the whole-node style. Style runs adjust on insert/delete to preserve formatting.

#### Scenario: Bold selection
- **WHEN** user selects "world" in "Hello world" and presses ⌘B
- **THEN** the word "world" renders bold while "Hello " stays regular

#### Scenario: Toggle italic on whole node
- **WHEN** user presses ⌘I with no text selected in a text node
- **THEN** the entire text node toggles italic

#### Scenario: Style preservation on insert
- **WHEN** user types "X" between a bold and regular segment
- **THEN** the inserted character inherits the style of the preceding segment and run boundaries adjust

### Requirement: .fig roundtrip for style runs
The .fig import SHALL parse characterStyleIDs and styleOverrideTable from TextData into StyleRun arrays. The .fig export SHALL write back with a deduped style table.

#### Scenario: Import rich text from .fig
- **WHEN** a .fig file with mixed bold/italic text is imported
- **THEN** the style runs are correctly reconstructed

## Modified Requirements

### Requirement: Text selection via mouse drag (MODIFIED)
Double-click SHALL select the word at click position. Triple-click SHALL select the entire text. Single click positions cursor. Drag extends selection. Click outside commits.

#### Scenario: Double-click selects word
- **WHEN** user double-clicks on "world" in "Hello world" during editing
- **THEN** "world" is selected

#### Scenario: Triple-click selects all
- **WHEN** user triple-clicks inside a text node during editing
- **THEN** all text is selected

### Requirement: TextEditor class in core (MODIFIED)
TextEditor SHALL additionally support selectLine(pos) and selectLineAt(x, y) methods for line-level selection.

#### Scenario: Select line
- **WHEN** selectLineAt is called at a position within line 2
- **THEN** the entire second line is selected
