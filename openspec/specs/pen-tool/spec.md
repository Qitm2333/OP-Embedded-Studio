# pen-tool Specification

## Purpose
Pen tool for vector path creation using a vector network data model. Supports bezier curves with tangent handles, open/closed paths, and Figma-compatible vectorNetworkBlob binary encoding.
## Requirements
### Requirement: Pen tool with vector network model
Pressing P SHALL activate the pen tool. Clicking places corner points, click+drag places curve points with bezier handles. The underlying data model SHALL use vector networks (not simple paths).

#### Scenario: Place corner points
- **WHEN** user clicks three positions with the pen tool
- **THEN** a path with three straight-line segments is created

#### Scenario: Place curve point
- **WHEN** user clicks and drags with the pen tool
- **THEN** a bezier curve point is created with tangent handles matching the drag direction and length

### Requirement: Open and closed paths
Clicking the first point SHALL close the path. Pressing Escape SHALL commit an open path.

#### Scenario: Close path
- **WHEN** user clicks on the first point of an in-progress path
- **THEN** the path closes into a loop

#### Scenario: Open path
- **WHEN** user presses Escape during pen tool drawing
- **THEN** the current path is committed as an open path

### Requirement: Vector network blob encoding
Vector network data SHALL be encoded/decoded using the Figma vectorNetworkBlob binary format for .fig compatibility.

#### Scenario: Encode vector data
- **WHEN** a vector node is created with the pen tool
- **THEN** the vector data can be encoded to the binary vectorNetworkBlob format

#### Scenario: Decode imported vector data
- **WHEN** a .fig file containing vector nodes is imported
- **THEN** the vectorNetworkBlob is decoded into editable vector network data

### Requirement: Open path rendering
Open paths SHALL be rendered as open strokes, not closed and filled.

#### Scenario: Open path stroke
- **WHEN** an open vector path has a stroke applied
- **THEN** the path is rendered as an open stroke line, not as a closed filled shape

### Requirement: Preview line
During pen tool drawing, a preview line SHALL connect the last placed point to the current cursor position. The preview SHALL NOT start from (0,0).

#### Scenario: Preview line from last point
- **WHEN** user has placed one point and moves the cursor
- **THEN** a preview line extends from the last placed point to the cursor position

