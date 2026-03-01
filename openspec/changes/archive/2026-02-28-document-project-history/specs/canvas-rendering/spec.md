## ADDED Requirements

### Requirement: CanvasKit WASM rendering
The renderer SHALL use Skia CanvasKit WASM to draw all scene graph nodes onto an HTML canvas element.

#### Scenario: Canvas initialization
- **WHEN** the editor loads
- **THEN** CanvasKit WASM (canvaskit.wasm) is loaded and a GPU-accelerated surface is created

### Requirement: Shape rendering
The renderer SHALL draw RECTANGLE, ELLIPSE, LINE, STAR, POLYGON, and VECTOR nodes with their fill paints, stroke paints, opacity, and transforms.

#### Scenario: Rectangle with fill and stroke
- **WHEN** a rectangle node has a solid fill (#3B82F6) and a 2px stroke (#000)
- **THEN** the rectangle is rendered with the correct fill color, stroke color, and stroke width

### Requirement: Text rendering
The renderer SHALL render TEXT nodes using CanvasKit's Paragraph API with font family, weight, size, line height, and letter spacing.

#### Scenario: Text with Inter font
- **WHEN** a text node with fontName "Inter", fontSize 16, and characters "Hello" exists
- **THEN** the text is rendered at the correct position with the Inter font

### Requirement: Nested coordinate systems
The renderer SHALL apply parent transforms (position + rotation) when rendering child nodes, supporting arbitrary nesting depth.

#### Scenario: Rotated parent with child
- **WHEN** a frame is rotated 45° and contains a child rectangle
- **THEN** the child rectangle is rendered in the frame's rotated coordinate system

### Requirement: Selection outlines
The renderer SHALL draw selection outlines (blue rectangles) around selected nodes with resize handles at corners and edge midpoints.

#### Scenario: Select a node
- **WHEN** a node is selected
- **THEN** a blue outline with 8 resize handles appears around the node's bounds

### Requirement: Surface resize
The renderer SHALL recreate the Skia surface when the window is resized, maintaining correct dimensions.

#### Scenario: Window resize
- **WHEN** the browser window is resized
- **THEN** the canvas and Skia surface update to the new dimensions without artifacts

### Requirement: Silent crash prevention
The renderer SHALL detect and report rendering errors instead of silently failing.

#### Scenario: Rendering error
- **WHEN** a rendering operation encounters an error
- **THEN** the error is detected and reported rather than silently producing a blank canvas
