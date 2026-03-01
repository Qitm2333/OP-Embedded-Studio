# undo-redo Specification

## Purpose
Inverse-command undo/redo system. Records the inverse of every operation, enabling ⌘Z/⇧⌘Z across all editor actions (create, delete, move, resize, rotate, property changes).
## Requirements
### Requirement: Inverse-command undo
The undo system SHALL use an inverse-command pattern where every operation records its inverse. ⌘Z SHALL undo and ⇧⌘Z SHALL redo.

#### Scenario: Undo a move
- **WHEN** user moves a node and presses ⌘Z
- **THEN** the node returns to its original position

#### Scenario: Redo after undo
- **WHEN** user undoes a move and presses ⇧⌘Z
- **THEN** the node moves back to the position after the original move

### Requirement: All operations undoable
Undo/redo SHALL be wired into all editor operations: create, delete, move, resize, rotate, property changes, reparent, layout changes, and variable operations (create/delete variable, create collection, rename variable, rename collection, change variable color/value). Each variable mutation pushes an undo entry with forward and inverse callbacks.

#### Scenario: Undo node creation
- **WHEN** user creates a rectangle and presses ⌘Z
- **THEN** the rectangle is removed from the scene graph

#### Scenario: Undo property change
- **WHEN** user changes a node's fill color from blue to red and presses ⌘Z
- **THEN** the fill color reverts to blue

#### Scenario: Undo variable creation
- **WHEN** user creates a variable and presses ⌘Z
- **THEN** the variable is removed from the scene graph

#### Scenario: Undo variable rename
- **WHEN** user renames a variable and presses ⌘Z
- **THEN** the variable name reverts to the previous value

#### Scenario: Undo collection rename
- **WHEN** user renames a collection and presses ⌘Z
- **THEN** the collection name reverts to the previous value

