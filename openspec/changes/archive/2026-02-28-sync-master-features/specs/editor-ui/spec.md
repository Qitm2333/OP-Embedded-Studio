## ADDED Requirements

### Requirement: Component keyboard shortcuts
The editor SHALL support keyboard shortcuts for component operations: ⌥⌘K (create component), ⌥⌘B (detach instance), ⇧⌘K (create component set).

#### Scenario: Create component shortcut
- **WHEN** user selects a frame and presses ⌥⌘K
- **THEN** the frame becomes a component

### Requirement: Z-order keyboard shortcuts
The editor SHALL support ] (bring to front) and [ (send to back) keyboard shortcuts.

#### Scenario: Bring to front shortcut
- **WHEN** user selects a node and presses ]
- **THEN** the node moves to the top of its z-order

### Requirement: Visibility and lock keyboard shortcuts
The editor SHALL support ⇧⌘H (toggle visibility) and ⇧⌘L (toggle lock) keyboard shortcuts.

#### Scenario: Toggle visibility shortcut
- **WHEN** user selects a node and presses ⇧⌘H
- **THEN** the node's visibility toggles
