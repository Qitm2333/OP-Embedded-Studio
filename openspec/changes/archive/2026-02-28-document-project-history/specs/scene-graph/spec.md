## ADDED Requirements

### Requirement: Flat node storage with GUID keys
The scene graph SHALL store all nodes in a flat `Map<string, Node>` keyed by GUID string. Tree structure SHALL be maintained via `parentIndex` references on each node.

#### Scenario: Create and retrieve a node
- **WHEN** a node is created with type RECTANGLE and a parent GUID
- **THEN** the node is stored in the map and retrievable by its GUID

#### Scenario: Parent-child relationship
- **WHEN** a child node references a parent via parentIndex
- **THEN** `getChildren(parentId)` returns the child sorted by position string

### Requirement: Node types
The scene graph SHALL support node types: FRAME, RECTANGLE, ELLIPSE, LINE, TEXT, VECTOR, STAR, POLYGON, GROUP, BOOLEAN_OPERATION, DOCUMENT, CANVAS.

#### Scenario: Create each supported node type
- **WHEN** a node of each supported type is created
- **THEN** the node is stored with the correct type enum value

### Requirement: CRUD operations
The scene graph SHALL support create, read, update, and delete operations on nodes.

#### Scenario: Delete a node
- **WHEN** a node is deleted by GUID
- **THEN** the node is removed from the map and no longer returned by queries

#### Scenario: Update node properties
- **WHEN** a node's properties (size, fill, rotation) are updated
- **THEN** subsequent reads return the updated values

### Requirement: Hit testing
The scene graph SHALL support hit testing — given a point in canvas coordinates, return the topmost visible node at that position.

#### Scenario: Hit test on overlapping nodes
- **WHEN** two rectangles overlap and a point inside the overlap area is tested
- **THEN** the node with higher z-order (later in position string sorting) is returned

### Requirement: Rectangular area query
The scene graph SHALL support querying all nodes that intersect a given rectangle (for marquee selection).

#### Scenario: Marquee selection
- **WHEN** a rectangle area query is performed
- **THEN** all nodes whose bounds intersect the rectangle are returned

### Requirement: Unit test coverage
The scene graph SHALL have bun:test unit tests covering CRUD, parent-child, z-ordering, and hit testing.

#### Scenario: Unit tests pass
- **WHEN** `bun test ./tests/engine` is run
- **THEN** all scene graph unit tests pass in <50ms
