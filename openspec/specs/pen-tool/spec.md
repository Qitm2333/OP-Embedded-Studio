# pen-tool Specification

## Purpose
Pen tool for vector path creation and vector geometry editing using the vector network model. Supports open/closed paths, interactive tangent composition modes, and editing existing curves.

## Requirements
### Requirement: Pen tool activation and vector network model
Pressing `P` SHALL activate the Pen tool. Pen-created vectors SHALL use vector-network geometry (vertices, segments, tangents, regions), not flattened SVG path strings.

#### Scenario: Activate pen tool
- **WHEN** user presses `P`
- **THEN** active tool becomes `PEN`

#### Scenario: Create line segments
- **WHEN** user clicks multiple points without drag
- **THEN** segments are created with zero tangents (`tangentStart/tangentEnd = {0,0}`)

#### Scenario: Create curve segment
- **WHEN** user drags while placing a new point
- **THEN** non-zero tangents are recorded for bezier curvature

### Requirement: Open and closed path commit behavior
Path close intent SHALL be detected near the first vertex, but final close commit SHALL happen on `mouseUp`, not `mouseDown`.

#### Scenario: Close commit on mouseUp
- **WHEN** cursor is within close threshold to first vertex and user presses + releases pointer
- **THEN** the close segment is committed on release (`mouseUp`)

#### Scenario: Open path commit
- **WHEN** user presses `Escape` during Pen drawing
- **THEN** current path is committed as open (no fill region loop)

### Requirement: Closing handle drag behavior
When closing a path, dragging SHALL allow editing the closing handle on the closing vertex (vertex `0`) before commit.

#### Scenario: Closing preview while dragging
- **WHEN** close intent is active and user drags
- **THEN** preview renders closing segment (`last -> first`) with current handle values

#### Scenario: Closing commit with drag tangent
- **WHEN** close intent is active and pointer is released
- **THEN** closing segment end tangent uses the active closing drag tangent on vertex `0`

### Requirement: Pen tangent composition modes while drawing
During Pen drag, composition modifiers SHALL work consistently:
- default: Symmetric (`ANGLE_AND_LENGTH`)
- `Cmd/Ctrl`: Continuous (`ANGLE`) direction lock to sister handle axis, length editable
- `Alt/Option`: Corner (`NONE`) independent active handle, sister preserved

#### Scenario: Default symmetric drag
- **WHEN** user drags without modifiers
- **THEN** opposite handle mirrors active handle symmetrically

#### Scenario: Continuous drag with Cmd/Ctrl
- **WHEN** user drags and holds `Cmd/Ctrl`
- **THEN** active handle is constrained to sister axis and only length changes
- **AND** vertex handle composition is set to `ANGLE`

#### Scenario: Corner drag with Alt/Option
- **WHEN** user drags and holds `Alt/Option`
- **THEN** active handle is edited independently
- **AND** sister handle remains fixed as reference
- **AND** vertex handle composition is `NONE`

#### Scenario: Modifier release during same drag
- **WHEN** user changes modifier state mid-drag
- **THEN** behavior switches immediately to target composition mode without restarting drag

### Requirement: Closing-node default composition
At close-intent drag on vertex `0`, default composition SHALL be `Corner` to avoid mutating the sister handle unless explicitly requested by modifier behavior.

#### Scenario: Closing drag default keeps sister
- **WHEN** user drags close handle without modifiers
- **THEN** sister handle on vertex `0` keeps its prior value
- **AND** composition remains `NONE`

#### Scenario: Closing continuous uses frozen sister reference
- **WHEN** user presses `Cmd/Ctrl` during closing drag
- **THEN** sister handle on vertex `0` is preserved and used as continuous reference
- **AND** it is never zeroed by modifier transition

### Requirement: Entering node edit by double click
Double-clicking a vector while in Select mode SHALL enter geometry edit mode for that node.

#### Scenario: Enter node edit on vector
- **WHEN** user double-clicks a vector node
- **THEN** node edit state is initialized with absolute editable vertices/segments

### Requirement: Node-edit visual/interaction isolation
While in node-edit mode, base selection transform UI (selection bbox, resize/rotate cursor hit testing) SHALL be disabled for the edited node.

#### Scenario: No transform cursor in node-edit
- **WHEN** node-edit mode is active
- **THEN** hovering former selection corners does not produce resize/rotate cursors

### Requirement: Pen tool actions in node-edit mode
With Pen active and node-edit mode open:
- click on contour adds a vertex (segment split)
- click on endpoint resumes drawing from endpoint
- `Alt/Option` click on vertex removes vertex

#### Scenario: Add point on contour in node-edit
- **WHEN** Pen is active in node-edit and user clicks contour
- **THEN** nearest segment is split and a new anchor is inserted

#### Scenario: Resume from endpoint
- **WHEN** Pen is active in node-edit and user clicks endpoint
- **THEN** node-edit exits and Pen resumes path creation from that endpoint

### Requirement: Handle drag composition in node-edit mode
Handle drag in node-edit SHALL support composition modifiers:
- `Alt/Option`: break mirroring (`Corner`)
- `Cmd/Ctrl`: `Continuous` edit on same line as sister handle
- `Shift`: lock tangent direction to pre-drag direction for `Continuous`/`Symmetric`, editing length only

#### Scenario: Shift lock in continuous/symmetric
- **WHEN** handle drag is active on vertex with `ANGLE` or `ANGLE_AND_LENGTH` and `Shift` is held
- **THEN** tangent direction remains equal to pre-drag axis
- **AND** only tangent length changes

### Requirement: Bend-handle direction targeting for vector web
For `Cmd/Ctrl` + vertex drag bend mode, target handle SHALL be selected by incoming drag direction against segment-attachment direction at the vertex (tangent direction or neighbor fallback), not by nearest neighbor point distance.

#### Scenario: Multi-branch vertex target selection
- **WHEN** vertex has 3+ connected segments and user starts bend drag
- **THEN** target segment+tangent field is resolved by best directional alignment
- **AND** resolution is locked for that drag session

### Requirement: Pen render styling consistency
Committed vector style SHALL match drawing style conventions and preserve resumed style when editing/continuing existing vector paths.

#### Scenario: New open path style
- **WHEN** user commits a newly drawn open path
- **THEN** node gets stroke style consistent with live Pen rendering

#### Scenario: Resume existing path preserves style
- **WHEN** user resumes Pen from an existing vector endpoint and commits
- **THEN** fills/strokes from resumed node are preserved

### Requirement: vectorNetwork binary compatibility
Vector network data SHALL remain compatible with Figma-like `vectorNetworkBlob` encoding/decoding pipeline.

#### Scenario: Encode/decode compatibility
- **WHEN** vector is created/edited via Pen and saved/imported
- **THEN** geometry round-trips through vector network binary codec without losing structure
