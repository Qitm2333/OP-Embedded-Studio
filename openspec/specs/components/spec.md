# components Specification

## Purpose
Components, component sets, instances — create, instantiate, detach, go-to-main component, component labels, opaque container hit testing.
## Requirements

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
The editor SHALL create an INSTANCE node from a COMPONENT via context menu, copying its visual properties and deep-cloning children with `componentId` mapping. The instance is placed 40px to the right of the source component. Instance creation is available only through the context menu (no button in properties panel).

#### Scenario: Create instance via context menu
- **WHEN** user right-clicks a component and selects "Create instance"
- **THEN** an INSTANCE appears to the right, visually identical to the component

#### Scenario: Instance children have componentId mapping
- **WHEN** an instance is created from a component with children [A, B]
- **THEN** instance children have `componentId` pointing to A and B respectively

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

### Requirement: Live component-instance sync
The scene graph SHALL propagate property changes from a COMPONENT to all its INSTANCE nodes. Synced properties include: width, height, fills, strokes, effects, opacity, corner radii, layout properties, and clipsContent. The store SHALL auto-trigger sync after `updateNode`, `commitMove`, and `commitResize` when the edited node is inside a COMPONENT.

#### Scenario: Edit component updates instances
- **WHEN** user changes the fill color of a main component
- **THEN** all instances of that component update to the new fill color

#### Scenario: Resize component syncs to instances
- **WHEN** user resizes a main component
- **THEN** all instances resize to match

### Requirement: Override preservation during sync
Instances SHALL maintain an `overrides` record. When syncing, properties marked in overrides are skipped. Child-level overrides use `${childId}:${propertyKey}` keys. Overridable child properties include name, text, fontSize, fontWeight, fontFamily, plus all synced visual/layout properties.

#### Scenario: Override preserved during sync
- **WHEN** an instance child has text overridden to "Custom" and the component child text changes to "New Default"
- **THEN** the instance child's text remains "Custom" while non-overridden properties sync

### Requirement: New children propagate to instances
When a new child is added to a COMPONENT, sync SHALL clone the new child into all existing instances.

#### Scenario: Add child to component
- **WHEN** user adds a new rectangle inside a component that has two instances
- **THEN** both instances gain a cloned copy of the new rectangle

### Requirement: Instance child order matches component
After sync, instance children SHALL be reordered to match the component's child order.

#### Scenario: Reorder component children
- **WHEN** component children are reordered from [A, B] to [B, A]
- **THEN** after sync, instance children reflect the new order
