# snap-guides Specification

## Purpose
Smart alignment guides during node manipulation. Edge and center snapping with rotation-aware bounding boxes, using sibling nodes in absolute canvas coordinates.
## Requirements
### Requirement: Edge and center snapping
When moving or resizing nodes, snap guides SHALL appear when edges or centers align with sibling nodes (±1px threshold).

#### Scenario: Horizontal edge snap
- **WHEN** user drags a node and its left edge aligns with another node's left edge
- **THEN** a red vertical snap guide line appears at the aligned X coordinate

#### Scenario: Center snap
- **WHEN** user drags a node and its horizontal center aligns with another node's center
- **THEN** a red snap guide line appears at the center coordinate

### Requirement: Rotation-aware snap guides
Snap guides SHALL use rotation-aware bounding boxes. Snap calculations SHALL work correctly for rotated nodes.

#### Scenario: Snap rotated node
- **WHEN** a rotated node is moved near an unrotated node
- **THEN** snap guides align to the rotated node's actual visual bounds

### Requirement: Sibling-based absolute coordinates
Snap guide calculations SHALL use sibling nodes in absolute (canvas) coordinates, not parent-relative coordinates.

#### Scenario: Snap across nesting levels
- **WHEN** a node inside a frame is moved near a node outside the frame
- **THEN** snap guides correctly compare positions in absolute canvas coordinates

