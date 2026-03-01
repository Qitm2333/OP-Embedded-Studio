## ADDED Requirements

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
