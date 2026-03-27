# vector-edit Specification

## Purpose
Geometry edit mode for VECTOR nodes: direct editing of anchors, segments, and tangents without invoking base transform interactions.

## Requirements
### Requirement: Enter curve edit mode
Double-clicking a VECTOR node in Select mode SHALL enter geometry edit mode for that node.

#### Scenario: Enter by double-click
- **WHEN** user double-clicks a vector curve
- **THEN** editor opens geometry edit mode for that vector
- **AND** editable vertices/segments are initialized

### Requirement: Edit mode scope
Only one vector SHALL be actively edited at a time.

#### Scenario: Enter another vector
- **WHEN** user double-clicks a different vector while one vector is in edit mode
- **THEN** previous edit session ends
- **AND** new vector becomes the active edited vector

### Requirement: Exit curve edit mode
User SHALL be able to exit curve edit mode and return to normal selection interactions.

#### Scenario: Exit with Escape
- **WHEN** curve edit mode is active and user presses `Escape`
- **THEN** curve edit mode ends

#### Scenario: Exit by tool/context switch
- **WHEN** curve edit mode is active and user switches to incompatible context (for example selects non-geometry transform workflow)
- **THEN** curve edit mode ends cleanly

### Requirement: Transform interaction isolation in edit mode
While curve edit mode is active, base selection transform bbox interactions SHALL be disabled for the edited vector.

#### Scenario: Hidden/non-interactive bbox corners
- **WHEN** user hovers where resize/rotate corners would normally be
- **THEN** transform cursors are not shown
- **AND** resize/rotate handles are not hit-testable

### Requirement: Vertex selection and direct drag
Anchors in curve edit mode SHALL support direct manipulation by drag.

#### Scenario: Drag an anchor
- **WHEN** user drags an anchor point in curve edit mode
- **THEN** anchor position updates by pointer delta
- **AND** connected segments update in preview and final geometry

### Requirement: Handle drag without modifiers
Dragging a tangent handle without modifiers SHALL use the node's current composition rules.

#### Scenario: Default handle drag
- **WHEN** user drags a tangent with no modifier keys
- **THEN** tangent updates according to current handle composition of the vertex

### Requirement: Continuous override in curve edit mode
Holding `Cmd/Ctrl` while dragging a tangent SHALL force Continuous behavior for the drag.

#### Scenario: Cmd/Ctrl tangent drag
- **WHEN** user drags a tangent while holding `Cmd/Ctrl`
- **THEN** active tangent direction is constrained to the sister-handle axis
- **AND** active tangent length changes with drag

### Requirement: Corner override in curve edit mode
Holding `Alt/Option` while dragging a tangent SHALL force independent handle editing.

#### Scenario: Alt/Option tangent drag
- **WHEN** user drags a tangent while holding `Alt/Option`
- **THEN** active tangent changes independently
- **AND** sister tangent remains unchanged

### Requirement: Shift axis lock for Continuous/Symmetric
Holding `Shift` during tangent drag on `Continuous` (`ANGLE`) or `Symmetric` (`ANGLE_AND_LENGTH`) vertices SHALL lock direction to pre-drag axis and allow length-only edits.

#### Scenario: Shift lock with Continuous
- **WHEN** user starts dragging a tangent on `ANGLE` vertex and then holds `Shift`
- **THEN** tangent direction stays equal to pre-drag direction
- **AND** only tangent length changes

#### Scenario: Shift lock with Symmetric
- **WHEN** user starts dragging a tangent on `ANGLE_AND_LENGTH` vertex and then holds `Shift`
- **THEN** both tangents stay collinear on pre-drag axis
- **AND** only lengths update per composition rules

### Requirement: Modifier transitions during one drag
Modifier changes (`Cmd/Ctrl`, `Alt/Option`, `Shift`) during an active drag SHALL be applied live without canceling drag.

#### Scenario: Toggle modifiers mid-drag
- **WHEN** user changes modifier keys while still dragging a tangent
- **THEN** active composition behavior switches immediately
- **AND** drag session continues from current pointer state

### Requirement: Bend mode handle targeting on anchor drag
For bend override (`Cmd/Ctrl` + anchor drag), edited tangent SHALL be determined by segment attachment direction at the anchor, not by nearest neighbor-point distance.

#### Scenario: Direction-based target on 2-segment vertex
- **WHEN** vertex has two attached segments and user starts bend drag with `Cmd/Ctrl`
- **THEN** edited tangent is chosen by best directional alignment to drag direction

#### Scenario: Direction-based target on multi-branch vertex
- **WHEN** vertex has 3+ attached segments and user starts bend drag with `Cmd/Ctrl`
- **THEN** edited tangent/segment is resolved by segment attachment direction
- **AND** selected target supports vector-web branching topology

### Requirement: Bend mode target lock
Resolved bend target SHALL lock after initial determination for the current drag session.

#### Scenario: Lock target after initial resolution
- **WHEN** bend drag begins and target tangent is resolved
- **THEN** only that tangent is edited for the remainder of the drag
- **AND** non-target tangents keep original coordinates

### Requirement: Pen interactions while already in curve edit mode
With Pen active inside curve edit mode, contour insertion, endpoint resume, and point deletion SHALL be available.

#### Scenario: Insert anchor on contour
- **WHEN** Pen is active and user clicks a segment in curve edit mode
- **THEN** segment is split and new anchor is inserted at hit position

#### Scenario: Resume drawing from endpoint
- **WHEN** Pen is active and user clicks an open-path endpoint in curve edit mode
- **THEN** editor resumes path drawing from that endpoint

#### Scenario: Delete anchor with Alt/Option click
- **WHEN** Pen is active and user `Alt/Option`-clicks an anchor in curve edit mode
- **THEN** anchor is removed and neighboring segments are reconnected if topology allows

### Requirement: Align selected anchors relative to each other
When two or more anchors are selected in curve edit mode, alignment buttons in the position panel SHALL reposition those anchors relative to each other instead of operating on the parent node.

#### Scenario: Align left (min X)
- **WHEN** 2+ anchors are selected and user clicks Align Left
- **THEN** all selected anchors move to the X coordinate of the leftmost anchor
- **AND** unselected anchors and tangents are unaffected

#### Scenario: Align right (max X)
- **WHEN** 2+ anchors are selected and user clicks Align Right
- **THEN** all selected anchors move to the X coordinate of the rightmost anchor
- **AND** unselected anchors and tangents are unaffected

#### Scenario: Align center horizontally
- **WHEN** 2+ anchors are selected and user clicks Align Center Horizontally
- **THEN** all selected anchors move to the midpoint X between leftmost and rightmost selected anchor
- **AND** unselected anchors and tangents are unaffected

#### Scenario: Align top (min Y)
- **WHEN** 2+ anchors are selected and user clicks Align Top
- **THEN** all selected anchors move to the Y coordinate of the topmost anchor
- **AND** unselected anchors and tangents are unaffected

#### Scenario: Align bottom (max Y)
- **WHEN** 2+ anchors are selected and user clicks Align Bottom
- **THEN** all selected anchors move to the Y coordinate of the bottommost anchor
- **AND** unselected anchors and tangents are unaffected

#### Scenario: Align center vertically
- **WHEN** 2+ anchors are selected and user clicks Align Center Vertically
- **THEN** all selected anchors move to the midpoint Y between topmost and bottommost selected anchor
- **AND** unselected anchors and tangents are unaffected

#### Scenario: Single anchor selected — no vertex alignment
- **WHEN** exactly 1 anchor is selected and user clicks any alignment button
- **THEN** alignment operates on the parent node as in normal selection mode
- **AND** no vertex repositioning occurs

#### Scenario: No anchors selected — no vertex alignment
- **WHEN** no anchors are selected and user clicks any alignment button
- **THEN** alignment operates on the parent node as in normal selection mode

### Requirement: Visual preview correctness during curve edit
Interactive preview in curve edit mode SHALL render active tangent feedback from anchor to active tangent endpoint.

#### Scenario: Active tangent preview line
- **WHEN** user drags an active tangent
- **THEN** preview line is rendered from anchor to active tangent endpoint
- **AND** preview does not render a misleading line between non-active handles
