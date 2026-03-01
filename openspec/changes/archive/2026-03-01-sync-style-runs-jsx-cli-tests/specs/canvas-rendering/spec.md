# canvas-rendering Specification (delta)

## New Requirements

### Requirement: Mixed-style text rendering
The renderer SHALL render text nodes with per-character formatting using CanvasKit ParagraphBuilder.pushStyle/pop. Each StyleRun segment pushes its own TextStyle (weight, slant, decoration) before adding text, then pops to restore the default style.

#### Scenario: Render mixed bold and regular text
- **WHEN** a text node has "Hello " (regular) + "world" (bold)
- **THEN** the renderer outputs a single Paragraph with two style segments, "world" visually bold
