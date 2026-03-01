# scene-graph Specification (delta)

## New Requirements

### Requirement: Polygon and Star node properties
SceneNode SHALL include `pointCount: number` (default 5) and `starInnerRadius: number` (default 0.38). POLYGON nodes use `pointCount` as the number of sides (minimum 3). STAR nodes use `pointCount` as the number of outer points and `starInnerRadius` as the ratio of inner to outer radius.

#### Scenario: Create polygon node
- **WHEN** a POLYGON node is created with pointCount=6
- **THEN** the node stores pointCount=6 and renders as a regular hexagon

#### Scenario: Create star node
- **WHEN** a STAR node is created with pointCount=5 and starInnerRadius=0.38
- **THEN** the node stores both properties and renders as a 5-pointed star

### Requirement: Tool type includes Polygon and Star
The Tool type union SHALL include POLYGON and STAR. The TOOLS array SHALL include POLYGON and STAR in the Rectangle flyout. TOOL_SHORTCUTS SHALL NOT include entries for Polygon or Star (flyout-only tools).
