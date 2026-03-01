# group-ungroup Specification

## Purpose
Group and ungroup node operations (⌘G/⇧⌘G). Creates GROUP nodes from selection, ungroups by reparenting children, sorts by visual position, and handles null node edge cases.
## Requirements
### Requirement: Group selection
⌘G SHALL group the current selection into a GROUP node. The group inherits the bounding box of its children.

#### Scenario: Group three nodes
- **WHEN** user selects three shapes and presses ⌘G
- **THEN** a GROUP node is created containing the three shapes as children

### Requirement: Ungroup selection
⇧⌘G SHALL ungroup the selected group, moving its children to the group's parent at the group's position.

#### Scenario: Ungroup
- **WHEN** user selects a group and presses ⇧⌘G
- **THEN** the group is removed and its children become siblings of the group's former parent

### Requirement: Position-based sort on wrap
When grouping or wrapping in auto-layout, nodes SHALL be sorted by their visual position to maintain reading order.

#### Scenario: Group preserves visual order
- **WHEN** three nodes at positions X=300, X=100, X=200 are grouped
- **THEN** the children are ordered by position (X=100 first, X=300 last)

### Requirement: Null node crash prevention
Group/ungroup operations SHALL handle null node references gracefully without crashing.

#### Scenario: Null node in selection
- **WHEN** a group operation encounters a null node reference in the selection
- **THEN** the operation completes without crashing, skipping the null reference

