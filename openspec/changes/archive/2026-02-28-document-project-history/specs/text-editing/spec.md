## ADDED Requirements

### Requirement: Text tool creates text nodes
Pressing T SHALL activate the text tool. Clicking on canvas SHALL create a new empty text node with cursor blinking.

#### Scenario: Create text node
- **WHEN** user presses T and clicks on the canvas
- **THEN** an empty text node is created at the click position with a visible cursor

### Requirement: Inline text editing
Double-clicking a text node SHALL enter inline editing mode with a textarea overlay positioned over the canvas text. The canvas text and selection SHALL be hidden during editing.

#### Scenario: Enter edit mode
- **WHEN** user double-clicks a text node
- **THEN** a textarea overlay appears and the canvas-rendered text is hidden

### Requirement: CanvasKit Paragraph API rendering
Text nodes SHALL be rendered using CanvasKit's Paragraph API for proper text shaping, line breaking, and font metrics.

#### Scenario: Multi-line text wrapping
- **WHEN** a text node with a fixed width contains text longer than the width
- **THEN** the text wraps to multiple lines using Paragraph API layout

### Requirement: Font loading
The editor SHALL load Inter as the default font. The Local Font Access API SHALL be used to enumerate and load system fonts when available.

#### Scenario: Default font
- **WHEN** a text node is created without specifying a font
- **THEN** the Inter font is used for rendering

#### Scenario: System fonts
- **WHEN** the Local Font Access API is available
- **THEN** system fonts are enumerable in the font picker

### Requirement: Font weight support
Font weight SHALL be applied to both the CanvasKit text style and the textarea overlay during editing.

#### Scenario: Bold text rendering
- **WHEN** a text node has fontWeight 700
- **THEN** both the canvas rendering and the editing overlay display bold text

### Requirement: Blue editing outline
A blue outline SHALL appear around a text node during editing to indicate edit mode.

#### Scenario: Edit mode indicator
- **WHEN** user is editing a text node inline
- **THEN** a blue outline is visible around the text node bounds
