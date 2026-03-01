# context-menu Specification

## Purpose
Right-click context menu with Figma-style actions: clipboard, z-order, grouping, component, visibility, lock, and move-to-page.
## Requirements

### Requirement: Right-click context menu
Right-clicking on the canvas SHALL show a context menu with Figma-style actions. If clicking on a node, that node is selected first. If clicking empty canvas, selection is cleared.

#### Scenario: Right-click on node
- **WHEN** user right-clicks on a rectangle
- **THEN** the rectangle is selected and a context menu appears with available actions

#### Scenario: Right-click on empty canvas
- **WHEN** user right-clicks on empty canvas
- **THEN** selection is cleared and a context menu appears with paste action available

### Requirement: Context menu clipboard actions
The context menu SHALL include Copy (⌘C), Cut (⌘X), Paste here (⌘V), Duplicate (⌘D), and Delete (⌫). Clipboard actions are disabled when no selection exists.

#### Scenario: Copy from context menu
- **WHEN** user right-clicks a selected node and clicks "Copy"
- **THEN** the node is copied to clipboard

### Requirement: Context menu z-order actions
The context menu SHALL include "Bring to front" (]) and "Send to back" ([), disabled when no selection exists.

#### Scenario: Bring to front via menu
- **WHEN** user right-clicks a node and selects "Bring to front"
- **THEN** the node moves to the top of its parent's child list

### Requirement: Context menu grouping actions
The context menu SHALL include Group (⌘G, requires 2+ selected), Ungroup (⇧⌘G, shown for groups), and Add auto layout (⇧A).

#### Scenario: Group from context menu
- **WHEN** user selects two nodes, right-clicks, and selects "Group"
- **THEN** the nodes are grouped

### Requirement: Context menu component actions
The context menu SHALL include component actions in purple: Create component (⌥⌘K), Create component set (⇧⌘K, when 2+ components selected), Create instance (for components), Go to main component (for instances), Detach instance (⌥⌘B, for instances).

#### Scenario: Create component from menu
- **WHEN** user right-clicks a frame and selects "Create component"
- **THEN** the frame becomes a component

### Requirement: Context menu visibility and lock actions
The context menu SHALL include "Hide/Show" (⇧⌘H) and "Lock/Unlock" (⇧⌘L) for selected nodes. Labels toggle based on current state.

#### Scenario: Hide via context menu
- **WHEN** user right-clicks a visible node and selects "Hide"
- **THEN** the node becomes invisible

### Requirement: Context menu move to page
The context menu SHALL include a "Move to page" submenu listing all pages except the current one. Selected nodes are reparented to the chosen page.

#### Scenario: Move node to another page
- **WHEN** user right-clicks a node, opens "Move to page", and selects "Page 2"
- **THEN** the node is moved to Page 2
