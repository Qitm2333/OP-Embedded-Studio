## ADDED Requirements

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
