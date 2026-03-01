# editor-ui Specification (delta)

## New Requirements

### Requirement: Rich text formatting buttons
The TypographySection SHALL include B/I/U/S toggle buttons for Bold, Italic, Underline, and Strikethrough. When text is selected during editing, the buttons apply formatting to the selection. When editing with no selection, they toggle the whole-node style. The active state reflects current selection formatting.

#### Scenario: Bold button with selection
- **WHEN** user selects text and clicks the Bold button (or presses ⌘B)
- **THEN** the selection becomes bold and the B button shows active state

#### Scenario: Underline button with no selection
- **WHEN** user clicks the Underline button during editing with no selection
- **THEN** the entire text node's underline style toggles
