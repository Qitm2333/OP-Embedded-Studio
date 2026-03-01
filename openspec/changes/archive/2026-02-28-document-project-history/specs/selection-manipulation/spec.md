## ADDED Requirements

### Requirement: Click to select
Clicking on a node SHALL select it (deselecting all others). Clicking empty canvas SHALL deselect all.

#### Scenario: Select a single node
- **WHEN** user clicks on a rectangle
- **THEN** the rectangle is selected and all other nodes are deselected

### Requirement: Multi-select with shift
Shift+clicking a node SHALL toggle it in the current selection.

#### Scenario: Add to selection
- **WHEN** user shift+clicks a second node while one is already selected
- **THEN** both nodes are in the selection

### Requirement: Marquee selection
Dragging on empty canvas SHALL create a selection rectangle. All nodes intersecting the rectangle SHALL be selected on release.

#### Scenario: Marquee drag
- **WHEN** user drags from empty canvas across three nodes
- **THEN** all three nodes are selected when the drag ends

### Requirement: Move by dragging
Dragging a selected node SHALL move it (and all other selected nodes) by the drag delta.

#### Scenario: Drag to move
- **WHEN** user drags a selected node by 50px right
- **THEN** the node's X position increases by 50

### Requirement: Resize handles
Selected nodes SHALL display 8 resize handles (4 corners + 4 edge midpoints). Dragging a handle SHALL resize the node. Shift constrains proportions.

#### Scenario: Resize from corner
- **WHEN** user drags the bottom-right corner handle outward
- **THEN** the node's width and height increase

### Requirement: Rotation
Hovering just outside a corner handle SHALL show a rotation cursor. Dragging SHALL rotate the node. Shift SHALL snap to 15° increments.

#### Scenario: Rotate with snap
- **WHEN** user drags the rotation handle while holding shift
- **THEN** the rotation snaps to the nearest 15° increment

### Requirement: Duplicate
Alt+drag SHALL duplicate the selected node and move the duplicate. ⌘D SHALL duplicate in place.

#### Scenario: Alt+drag duplicate
- **WHEN** user alt+drags a selected rectangle
- **THEN** a copy of the rectangle is created at the drag position

### Requirement: Constrained drawing
Holding shift while drawing a shape SHALL constrain to square/circle.

#### Scenario: Shift+drag rectangle
- **WHEN** user draws a rectangle while holding shift
- **THEN** the rectangle is constrained to a square (equal width and height)

### Requirement: Nudge with arrows
Arrow keys SHALL move selected nodes by 1px. Shift+arrow SHALL move by 10px.

#### Scenario: Arrow nudge
- **WHEN** user presses the right arrow key with a node selected
- **THEN** the node moves 1px to the right

### Requirement: Delete selection
Backspace/Delete SHALL remove all selected nodes.

#### Scenario: Delete node
- **WHEN** user presses backspace with a node selected
- **THEN** the node is removed from the scene graph

### Requirement: Select all
⌘A SHALL select all nodes on the current canvas.

#### Scenario: Select all
- **WHEN** user presses ⌘A
- **THEN** all nodes on the canvas are selected
