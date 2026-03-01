# undo-redo Specification (delta)

## Modified Requirements

### Requirement: All operations undoable (MODIFIED)
Undo/redo SHALL cover all editor operations including variable operations: create variable, delete variable, rename variable, create collection, rename collection, and change variable color/value. Each variable mutation pushes an undo entry with forward and inverse callbacks.

#### Scenario: Undo variable creation
- **WHEN** user creates a variable and presses ⌘Z
- **THEN** the variable is removed from the scene graph

#### Scenario: Undo variable rename
- **WHEN** user renames a variable and presses ⌘Z
- **THEN** the variable name reverts to the previous value

#### Scenario: Undo collection rename
- **WHEN** user renames a collection and presses ⌘Z
- **THEN** the collection name reverts to the previous value
