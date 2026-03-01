# canvas-rendering Specification

## Purpose
Skia CanvasKit WASM rendering pipeline. Draws all scene graph nodes (shapes, text, effects) with transforms, selection outlines, and visual feedback onto an HTML canvas element.
## Requirements
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

### Requirement: Gradient rendering
The renderer SHALL draw gradient fills: GRADIENT_LINEAR, GRADIENT_RADIAL, GRADIENT_ANGULAR, and GRADIENT_DIAMOND using CanvasKit shaders with gradient stops and transform matrices.

#### Scenario: Linear gradient on rectangle
- **WHEN** a rectangle has a GRADIENT_LINEAR fill with stops at 0% (#FF0000) and 100% (#0000FF)
- **THEN** the rectangle renders with a smooth red-to-blue linear gradient

### Requirement: Image fill rendering
The renderer SHALL draw IMAGE fills using CanvasKit image decoding. Image transforms (scale, position) and scale modes (FILL, FIT, CROP, TILE) SHALL be applied.

#### Scenario: Image fill on frame
- **WHEN** a frame has an IMAGE fill with imageHash referencing a blob
- **THEN** the image is decoded and rendered within the frame bounds

### Requirement: Effect rendering
The renderer SHALL draw effects: DROP_SHADOW, INNER_SHADOW, LAYER_BLUR, BACKGROUND_BLUR, and FOREGROUND_BLUR using CanvasKit filters.

#### Scenario: Drop shadow on rectangle
- **WHEN** a rectangle has a DROP_SHADOW effect with offset (4, 4), radius 8, color rgba(0,0,0,0.25)
- **THEN** a shadow is rendered below the rectangle with the specified offset, blur, and color

### Requirement: Stroke cap, join, and dash rendering
The renderer SHALL apply stroke cap (NONE, ROUND, SQUARE, ARROW_LINES, ARROW_EQUILATERAL), join (MITER, BEVEL, ROUND), and dash pattern to strokes.

#### Scenario: Round cap dashed stroke
- **WHEN** a line has strokeCap ROUND and dashPattern [10, 5]
- **THEN** the line renders with rounded dash ends and 10px-on/5px-off pattern

### Requirement: Arc rendering
The renderer SHALL draw ellipses with arcData (startAngle, endAngle, innerRadius) as partial arcs or donuts.

#### Scenario: Semi-circle arc
- **WHEN** an ellipse has arcData with startAngle 0 and endAngle π
- **THEN** only the top half of the ellipse is rendered

### Requirement: Hover highlight rendering
The renderer SHALL draw a shape-aware hover outline for the node under the cursor. The outline follows the actual shape geometry (ellipses, rounded rects, vectors), not just the bounding box.

#### Scenario: Hover over ellipse
- **WHEN** the cursor hovers over an ellipse
- **THEN** a thin outline matching the ellipse shape is drawn

### Requirement: Section rendering
The renderer SHALL draw SECTION nodes with a title pill showing the section name. Title text color inverts based on pill background luminance. Frame name labels are shown for direct children of sections.

#### Scenario: Section with title
- **WHEN** a section named "Desktop" exists on the canvas
- **THEN** a title pill reading "Desktop" is rendered above the section bounds

#### Scenario: Section title luminance inversion
- **WHEN** a section has a dark fill color
- **THEN** the title text renders in white for readability

### Requirement: Canvas background color
The renderer SHALL fill the canvas background with the current page's `pageColor` property.

#### Scenario: Custom canvas background
- **WHEN** the user sets the page background color to dark gray
- **THEN** the canvas renders with a dark gray background instead of the default


### Requirement: Viewport culling
The renderer SHALL skip drawing nodes whose bounding boxes are entirely outside the visible viewport. Export rendering SHALL disable culling to render all nodes.

#### Scenario: Off-screen node skipped
- **WHEN** a node is completely outside the visible viewport
- **THEN** the renderer does not draw it

#### Scenario: Export renders all nodes
- **WHEN** `renderSceneToCanvas` is called for export
- **THEN** all nodes are rendered regardless of viewport position

### Requirement: Component label rendering
The renderer SHALL draw purple labels for COMPONENT, COMPONENT_SET, and INSTANCE nodes. Labels appear above the node (or inside for COMPONENT_SET children) with a diamond icon and node name.

#### Scenario: Instance label
- **WHEN** an INSTANCE named "Button" is on canvas
- **THEN** a purple label "Button" with diamond icon is rendered above it

### Requirement: Component set border rendering
The renderer SHALL draw COMPONENT_SET nodes with a dashed purple border (6px dash, 4px gap, 1.5px stroke width).

#### Scenario: Dashed border
- **WHEN** a COMPONENT_SET is visible on canvas
- **THEN** its border is rendered as dashed purple lines

### Requirement: Component label hit testing
The renderer SHALL support `hitTestComponentLabel(graph, x, y)` returning the node whose label was clicked, enabling click-to-select via label.

#### Scenario: Click component label
- **WHEN** user clicks on a component's purple label
- **THEN** the component is selected

### Requirement: Paint object reuse
The renderer SHALL reuse Skia Paint objects across frames instead of allocating new ones per render call.

#### Scenario: Multiple renders
- **WHEN** the scene is rendered 60 times per second
- **THEN** Paint objects are reused, not reallocated each frame

### Requirement: RAF render coalescing
The renderer SHALL coalesce multiple render requests within a single frame using `requestAnimationFrame`, rendering at most once per animation frame.

#### Scenario: Rapid state changes
- **WHEN** 10 state changes trigger renders within one frame
- **THEN** only one actual render occurs

### Requirement: Polygon and Star rendering
The renderer SHALL draw POLYGON and STAR nodes as regular polygon paths. For POLYGON, a path with `pointCount` vertices (minimum 3) is generated equidistant around the node's center. For STAR, `pointCount * 2` vertices alternate between outer radius and inner radius (scaled by `starInnerRadius`). Both types support fill, stroke, hover highlight, and selection outline. The starting vertex is at the top (−π/2 rotation offset).

#### Scenario: Render polygon
- **WHEN** a POLYGON node with pointCount=3 exists on canvas
- **THEN** an equilateral triangle is rendered within the node's bounding box

#### Scenario: Render star
- **WHEN** a STAR node with pointCount=5 and starInnerRadius=0.38 exists
- **THEN** a 5-pointed star is rendered with inner points at 38% of the outer radius

### Requirement: Variable binding resolution in renderer
The renderer SHALL resolve variable bindings before painting fills and strokes. When a fill or stroke has a bound variable, the renderer resolves the variable value using the collection's active mode and uses the resolved color.

#### Scenario: Render bound fill
- **WHEN** a rectangle's fill is bound to a COLOR variable with value red in Light mode
- **THEN** the rectangle renders with red fill

### Requirement: Image export rendering
The renderer SHALL support offscreen rendering to PNG, JPG, and WEBP via renderNodesToImage. Export uses an offscreen CanvasKit surface at the specified scale. JPG renders with opaque white background, PNG and WEBP render with transparency. Re-encoding for JPG/WEBP uses OffscreenCanvas.

#### Scenario: Export at 2× scale
- **WHEN** a 100×100 node is exported at 2× scale as PNG
- **THEN** the output image is 200×200 pixels with transparency

### Requirement: Scene version vs render version
The renderer SHALL distinguish between scene changes (increments sceneVersion + renderVersion) and viewport-only changes like pan/zoom (increments renderVersion only). UI panels and export preview observe sceneVersion to avoid unnecessary updates during navigation.

#### Scenario: Pan does not trigger export preview update
- **WHEN** user pans the canvas
- **THEN** sceneVersion does not change, so export preview is not re-rendered


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

### Requirement: Mixed-style text rendering
The renderer SHALL render text nodes with per-character formatting using CanvasKit ParagraphBuilder.pushStyle/pop. Each StyleRun segment pushes its own TextStyle (weight, slant, decoration) before adding text, then pops to restore the default style.

#### Scenario: Render mixed bold and regular text
- **WHEN** a text node has "Hello " (regular) + "world" (bold)
- **THEN** the renderer outputs a single Paragraph with two style segments, "world" visually bold
