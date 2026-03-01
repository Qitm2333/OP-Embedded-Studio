# canvas-rendering Specification (delta)

## New Requirements

### Requirement: Text editing overlay rendering
During text editing, the renderer SHALL draw on the canvas: a blue outline around the text node bounds, translucent blue rectangles for the text selection range, and a blinking black caret at the cursor position. The caret SHALL blink at ~530ms intervals and become solid (non-blinking) immediately after any input. Selection rects and caret position are obtained from TextEditor via getSelectionRects() and getCaretRect().

#### Scenario: Caret rendering
- **WHEN** user is editing text with no selection
- **THEN** a blinking black caret is drawn at the cursor position within the text node

#### Scenario: Selection rendering
- **WHEN** user has selected a range of text during editing
- **THEN** translucent blue rectangles are drawn behind the selected text glyphs

#### Scenario: Blue outline during editing
- **WHEN** user is editing a text node
- **THEN** a blue outline is drawn around the text node bounds (at selection color)
