## ADDED Requirements

### Requirement: Section creation with auto-adopt
Creating a section on the canvas SHALL automatically reparent overlapping sibling nodes into the section. Only nodes fully or partially within the section bounds are adopted.

#### Scenario: Draw section over existing nodes
- **WHEN** user draws a section that overlaps two rectangles
- **THEN** the two rectangles become children of the new section
