# scene-graph Specification

## Purpose
Hierarchical data structure managing all design nodes. Provides flat Map<GUID, Node> storage with parent-child tree via parentIndex, CRUD operations, hit testing, and spatial queries.
## Requirements
### Requirement: Flat node storage with GUID keys
The scene graph SHALL store all nodes in a flat `Map<string, SceneNode>` keyed by GUID string. Tree structure SHALL be maintained via `parentIndex` references on each node. Each SceneNode SHALL include `componentId` (nullable reference to main component for instances) and `overrides` (record of instance-level property overrides).

#### Scenario: Create and retrieve a node
- **WHEN** a node is created with type RECTANGLE and a parent GUID
- **THEN** the node is stored in the map and retrievable by its GUID

#### Scenario: Parent-child relationship
- **WHEN** a child node references a parent via parentIndex
- **THEN** `getChildren(parentId)` returns the child sorted by position string

#### Scenario: Node has component fields
- **WHEN** a SceneNode is created
- **THEN** it has `componentId: null` and `overrides: {}` by default

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


### Requirement: Clone tree
The scene graph SHALL support deep-cloning a node subtree to a new parent via `cloneTree(sourceId, parentId)`, copying all properties and recursively cloning children.

#### Scenario: Clone subtree
- **WHEN** `cloneTree` is called on a frame with two children
- **THEN** a new frame with two new children is created under the target parent

### Requirement: Create instance from component
The scene graph SHALL support creating an INSTANCE node from a COMPONENT via `createInstance(componentId, parentId)`, copying visual properties and deep-cloning children.

#### Scenario: Instance copies component children
- **WHEN** `createInstance` is called for a component with three children
- **THEN** the instance has three cloned children matching the component's

### Requirement: Detach instance
The scene graph SHALL support converting an INSTANCE to FRAME via `detachInstance(instanceId)`, clearing `componentId` and `overrides`.

#### Scenario: Detach changes type
- **WHEN** `detachInstance` is called on an instance
- **THEN** its type becomes FRAME and componentId becomes null

### Requirement: Get main component
The scene graph SHALL support `getMainComponent(instanceId)` returning the source COMPONENT for an instance.

#### Scenario: Retrieve main component
- **WHEN** `getMainComponent` is called on an instance
- **THEN** the linked COMPONENT node is returned

### Requirement: Deep hit testing
The scene graph SHALL support `hitTestDeep(px, py)` that traverses into COMPONENT and INSTANCE containers, unlike standard `hitTest` which treats them as opaque.

#### Scenario: Deep hit test enters component
- **WHEN** `hitTestDeep` is called at a position inside a component's child
- **THEN** the child is returned, not the component

### Requirement: Instance sync method
The SceneGraph SHALL expose a method to synchronize all INSTANCE nodes linked to a given COMPONENT, copying synced properties (width, height, fills, strokes, effects, opacity, cornerRadius, topLeftRadius, topRightRadius, bottomRightRadius, bottomLeftRadius, independentCorners, layoutMode, layoutWrap, primaryAxisAlign, counterAxisAlign, primaryAxisSizing, counterAxisSizing, itemSpacing, counterAxisSpacing, paddingTop, paddingRight, paddingBottom, paddingLeft, clipsContent). Array properties are shallow-copied. Override-marked properties are skipped.

#### Scenario: Sync propagates fills
- **WHEN** a component's fill is changed and sync is triggered
- **THEN** all instances of that component receive the new fill (unless overridden)

### Requirement: Clone children with mapping
The SceneGraph SHALL support recursively cloning children from a source parent to a destination parent, setting each clone's `componentId` to the source child's ID. This enables sync matching between component and instance children.

#### Scenario: Clone with mapping
- **WHEN** a component with nested frames is cloned to an instance
- **THEN** each cloned child (recursively) has `componentId` pointing to the original

### Requirement: Child sync
The SceneGraph SHALL support syncing instance children to component children by matching via `componentId`. Synced child properties include the standard synced property list plus name, text, fontSize, fontWeight, fontFamily. New children from the component are cloned into the instance. Instance children are reordered to match component child order.

#### Scenario: Sync matches children by componentId
- **WHEN** a component has children [A, B] and an instance has cloned children with `componentId` pointing to A and B
- **THEN** sync updates each instance child's non-overridden properties from the corresponding component child

### Requirement: Independent corner radius fields
SceneNode SHALL include `independentCorners` (boolean), `topLeftRadius`, `topRightRadius`, `bottomRightRadius`, `bottomLeftRadius` (numbers). When `independentCorners` is true, each corner radius is controlled independently.

#### Scenario: Independent corners
- **WHEN** a rectangle has `independentCorners: true` with topLeftRadius=8 and topRightRadius=0
- **THEN** the rectangle renders with rounded top-left and sharp top-right

### Requirement: Polygon and Star node properties
SceneNode SHALL include `pointCount: number` (field default 5) and `starInnerRadius: number` (default 0.38). POLYGON nodes use `pointCount` as the number of sides (minimum 3); the Polygon tool overrides pointCount to 3 at creation. STAR nodes use `pointCount` as the number of outer points (default 5) and `starInnerRadius` as the ratio of inner to outer radius.

#### Scenario: Create polygon node
- **WHEN** a POLYGON node is created with pointCount=6
- **THEN** the node stores pointCount=6 and renders as a regular hexagon

#### Scenario: Create star node
- **WHEN** a STAR node is created with pointCount=5 and starInnerRadius=0.38
- **THEN** the node stores both properties and renders as a 5-pointed star

### Requirement: Tool type includes Polygon and Star
The Tool type union SHALL include POLYGON and STAR. The TOOLS array SHALL include POLYGON and STAR in the Rectangle shapes flyout. No dedicated keyboard shortcuts are assigned to Polygon or Star.

### Requirement: Variable types
SceneGraph SHALL support Variable, VariableCollection, and VariableCollectionMode types. VariableType SHALL be COLOR | FLOAT | STRING | BOOLEAN. VariableValue SHALL be Color | number | string | boolean | { aliasId: string }. Variables are stored in a Map keyed by ID. Collections group variables and define modes.

#### Scenario: Create color variable
- **WHEN** a COLOR variable is added with value { r: 1, g: 0, b: 0, a: 1 }
- **THEN** the variable is stored and resolvable by ID

### Requirement: Variable collections and modes
SceneGraph SHALL support variable collections with multiple modes (e.g., Light/Dark). Each collection has an activeMode. Mode switching changes which values are resolved for variables in that collection.

#### Scenario: Switch mode
- **WHEN** a collection has Light and Dark modes and activeMode is switched to Dark
- **THEN** resolveVariable returns the Dark mode value for variables in that collection

### Requirement: Variable alias resolution
Variables SHALL support alias values ({ aliasId: string }) that reference other variables. Resolution follows the alias chain. Circular aliases SHALL be detected and return undefined (no infinite loop).

#### Scenario: Alias chain
- **WHEN** variable A aliases variable B which has value 42
- **THEN** resolving A returns 42

#### Scenario: Circular alias
- **WHEN** variable A aliases B and B aliases A
- **THEN** resolving A returns undefined

### Requirement: Variable binding to node properties
SceneGraph SHALL support binding variables to node properties via bindVariable(nodeId, field, variableId). Bound fields are stored in the node's variableBindings record. unbindVariable removes a binding.

#### Scenario: Bind color variable to fill
- **WHEN** a COLOR variable is bound to a node's fill
- **THEN** the node's variableBindings record contains the binding

### Requirement: Variable import from .fig files
The .fig import pipeline SHALL parse VARIABLE type NodeChanges and extract paint variable bindings (fills/strokes), creating corresponding Variable and VariableCollection objects in the scene graph.

#### Scenario: Import .fig with variables
- **WHEN** a .fig file containing color variables and paint bindings is imported
- **THEN** the variables, collections, and bindings are restored in the scene graph

### Requirement: Variable removal cleans up bindings
Removing a variable SHALL clean up all bindings referencing it across all nodes.

#### Scenario: Remove variable with bindings
- **WHEN** a variable bound to three nodes is removed
- **THEN** all three nodes' variableBindings no longer reference that variable

### Requirement: StyleRun model
SceneNode SHALL support a `styleRuns` array of `{start, length, style}` where style is CharacterStyleOverride (fontWeight, italic, textDecoration). The scene graph SHALL provide helpers to apply/toggle styles on ranges and adjust runs on insert/delete.

#### Scenario: Apply bold to range
- **WHEN** applyStyleToRange is called with fontWeight 700 on characters 6–11
- **THEN** the styleRuns array contains a run for that range with fontWeight 700

### Requirement: JSX renderer
@open-pencil/core SHALL export TreeNode builder functions (Frame, Text, Rectangle, Ellipse, etc.) and two rendering paths: renderTreeNode() (tree → scene graph, no deps) and renderJsx() (JSX string → esbuild → tree → scene graph, for CLI/headless). Builder functions SHALL accept Tailwind-like shorthand props: w, h, bg, rounded, flex, gap, p/px/py, justify, items, shadow, blur.

#### Scenario: Build tree from functions
- **WHEN** Frame({w: 200, h: 100, bg: '#f00'}, [Text({children: 'Hello'})]) is called
- **THEN** a TreeNode with type FRAME, width 200, height 100, and red fill is created with a TEXT child

#### Scenario: Render JSX string
- **WHEN** renderJsx('<Frame w={100}><Text>Hi</Text></Frame>') is called
- **THEN** a scene graph with a FRAME parent and TEXT child is produced

### Requirement: Scene node to JSX export
@open-pencil/core SHALL export a sceneNodeToJsx() function that converts a SceneNode subtree into JSX string using builder function syntax (Frame, Text, Rectangle, etc.) with Tailwind-like shorthand props. The output is valid JSX consumable by renderJsx().

#### Scenario: Export frame with children
- **WHEN** sceneNodeToJsx is called on a frame with a rectangle and text child
- **THEN** a JSX string with Frame wrapping Rectangle and Text is returned

#### Scenario: Export with effects
- **WHEN** sceneNodeToJsx is called on a node with drop shadow
- **THEN** the JSX includes shadow props in the output
