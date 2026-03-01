## ADDED Requirements

### Requirement: Multi-page document support
The scene graph SHALL support multiple CANVAS (page) nodes as children of the DOCUMENT root. Each page has its own child tree. Pages can be added, deleted, and renamed.

#### Scenario: Add a new page
- **WHEN** user adds a page
- **THEN** a new CANVAS node is created as a child of the DOCUMENT root and becomes the active page

#### Scenario: Delete a page
- **WHEN** user deletes a page and at least two pages exist
- **THEN** the page is removed and the adjacent page becomes active

#### Scenario: Rename a page
- **WHEN** user renames a page
- **THEN** the CANVAS node's name property updates

### Requirement: Section node type
The scene graph SHALL support SECTION nodes. Sections are top-level only (direct children of CANVAS), cannot nest inside frames or groups. Sections auto-adopt overlapping siblings on creation.

#### Scenario: Create section
- **WHEN** user draws a section on the canvas
- **THEN** a SECTION node is created as a direct child of the current page

#### Scenario: Section auto-adopt
- **WHEN** a section is created overlapping existing nodes
- **THEN** overlapping sibling nodes are reparented into the section

#### Scenario: Section nesting restriction
- **WHEN** user attempts to move a section inside a frame or group
- **THEN** the section remains at top-level (direct child of CANVAS)

### Requirement: Extended node type union
The NodeType union SHALL include: CANVAS, FRAME, RECTANGLE, ROUNDED_RECTANGLE, ELLIPSE, TEXT, LINE, STAR, POLYGON, VECTOR, GROUP, SECTION, COMPONENT, COMPONENT_SET, INSTANCE, CONNECTOR, SHAPE_WITH_TEXT.

#### Scenario: NodeType covers all Figma types used in import
- **WHEN** a .fig file containing ROUNDED_RECTANGLE, COMPONENT, INSTANCE, CONNECTOR, or SHAPE_WITH_TEXT nodes is imported
- **THEN** each node is created with its correct type in the scene graph

### Requirement: Hover state tracking
The scene graph state SHALL track a `hoveredNodeId` for the node currently under the cursor.

#### Scenario: Hover a node
- **WHEN** user moves the cursor over a node
- **THEN** `hoveredNodeId` updates to that node's ID and a render is requested

### Requirement: Extended fill types
The Fill interface SHALL support types: SOLID, GRADIENT_LINEAR, GRADIENT_RADIAL, GRADIENT_ANGULAR, GRADIENT_DIAMOND, IMAGE. Gradient fills include `gradientStops` and `gradientTransform`. Image fills include `imageHash`, `imageScaleMode`, and `imageTransform`.

#### Scenario: Gradient fill on a node
- **WHEN** a node has a GRADIENT_LINEAR fill with two stops
- **THEN** the fill stores both gradient stops with position and color, plus a 2×3 gradient transform

### Requirement: Extended stroke properties
The Stroke interface SHALL support `cap` (NONE, ROUND, SQUARE, ARROW_LINES, ARROW_EQUILATERAL), `join` (MITER, BEVEL, ROUND), and `dashPattern` (array of dash/gap lengths).

#### Scenario: Dashed stroke
- **WHEN** a node has a stroke with dashPattern [10, 5]
- **THEN** the stroke renders as a dashed line with 10px dashes and 5px gaps

### Requirement: Per-page viewport state
Each page SHALL maintain independent viewport state (panX, panY, zoom, pageColor). Switching pages restores the viewport.

#### Scenario: Switch page restores viewport
- **WHEN** user switches from Page 1 (zoomed to 200%) to Page 2 and back
- **THEN** Page 1's viewport returns to 200% zoom at the previous pan position
