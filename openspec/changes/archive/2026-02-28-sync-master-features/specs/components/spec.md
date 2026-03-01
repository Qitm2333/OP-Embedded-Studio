## ADDED Requirements

### Requirement: Create component from selection
The editor SHALL convert selected frames/groups to COMPONENT type, or wrap multiple selected nodes in a new COMPONENT node (⌥⌘K). Single frame/group converts in-place; multiple nodes wraps in a bounding component.

#### Scenario: Convert frame to component
- **WHEN** user selects a single frame and presses ⌥⌘K
- **THEN** the frame's type changes to COMPONENT

#### Scenario: Wrap multiple nodes in component
- **WHEN** user selects three rectangles and presses ⌥⌘K
- **THEN** a COMPONENT node wraps them, positioned at their bounding box

### Requirement: Create component set from components
The editor SHALL combine multiple selected COMPONENT nodes into a COMPONENT_SET container (⇧⌘K). The set gets a dashed purple border and a 40px padding around its children.

#### Scenario: Create component set
- **WHEN** user selects two COMPONENT nodes and presses ⇧⌘K
- **THEN** a COMPONENT_SET wraps them with dashed purple border

### Requirement: Create instance from component
The editor SHALL create an INSTANCE node from a COMPONENT, copying its visual properties and children. The instance is placed 40px to the right of the source component.

#### Scenario: Create instance via context menu
- **WHEN** user right-clicks a component and selects "Create instance"
- **THEN** an INSTANCE appears to the right, visually identical to the component

### Requirement: Detach instance
The editor SHALL convert an INSTANCE back to a regular FRAME, clearing its componentId and overrides (⌥⌘B).

#### Scenario: Detach instance
- **WHEN** user selects an instance and presses ⌥⌘B
- **THEN** the instance becomes a FRAME with no component link

### Requirement: Go to main component
The editor SHALL navigate to and select the main COMPONENT for a selected INSTANCE, switching pages if needed.

#### Scenario: Navigate to main component
- **WHEN** user right-clicks an instance and selects "Go to main component"
- **THEN** the main component is selected and centered in the viewport

### Requirement: Component labels
The renderer SHALL draw always-visible purple labels above COMPONENT and INSTANCE nodes (or inside COMPONENT_SET children). Labels show the node name with a diamond icon.

#### Scenario: Component label visible
- **WHEN** a COMPONENT node exists on canvas
- **THEN** a purple label with the component name is rendered above it

### Requirement: Component set visual treatment
COMPONENT_SET nodes SHALL render with a dashed purple border (6px dash, 4px gap, 1.5px width) instead of a solid border.

#### Scenario: Component set border
- **WHEN** a COMPONENT_SET is on canvas
- **THEN** it renders with a dashed purple border

### Requirement: Opaque container hit testing
COMPONENT and INSTANCE nodes SHALL behave as opaque containers for hit testing — clicking selects the component/instance itself, not its children. Children are accessible only via double-click (deep hit test).

#### Scenario: Click on component child
- **WHEN** user clicks a rectangle inside a component
- **THEN** the component is selected, not the rectangle

#### Scenario: Double-click into component
- **WHEN** user double-clicks a child inside a component
- **THEN** the child is selected (deep selection)
