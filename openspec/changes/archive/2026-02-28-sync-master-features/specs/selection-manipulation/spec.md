## ADDED Requirements

### Requirement: Z-order manipulation
The editor SHALL support bringing selected nodes to front (]) and sending to back ([). Bring to front moves node to end of parent's childIds; send to back moves to start.

#### Scenario: Bring to front
- **WHEN** user selects a node and presses ]
- **THEN** the node moves to the top of its sibling z-order

#### Scenario: Send to back
- **WHEN** user selects a node and presses [
- **THEN** the node moves to the bottom of its sibling z-order

### Requirement: Toggle visibility
The editor SHALL support toggling node visibility (⇧⌘H). Hidden nodes are not rendered but remain in the scene graph and layers panel.

#### Scenario: Hide node
- **WHEN** user selects a visible node and presses ⇧⌘H
- **THEN** the node's `visible` property becomes false

### Requirement: Toggle lock
The editor SHALL support toggling node lock state (⇧⌘L). Locked nodes cannot be selected or moved via canvas interaction.

#### Scenario: Lock node
- **WHEN** user selects a node and presses ⇧⌘L
- **THEN** the node's `locked` property becomes true

### Requirement: Move to page
The editor SHALL support moving selected nodes to a different page, reparenting them under the target page's CANVAS node.

#### Scenario: Move selection to another page
- **WHEN** user moves a node to Page 2 via context menu
- **THEN** the node is reparented under Page 2's CANVAS node and removed from the current page

### Requirement: Rename node
The editor SHALL support renaming nodes programmatically via `renameNode(id, name)`.

#### Scenario: Rename a layer
- **WHEN** `renameNode` is called with a new name
- **THEN** the node's name property is updated
