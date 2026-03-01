# canvas-rendering Specification (delta)

## New Requirements

### Requirement: Polygon and Star rendering
The renderer SHALL draw POLYGON and STAR nodes as regular polygon paths. For POLYGON, a path with `pointCount` vertices is generated equidistant around the node's center. For STAR, `pointCount * 2` vertices alternate between outer radius and inner radius (scaled by `starInnerRadius`). Both types support fill, stroke, hover highlight, and selection outline. The starting vertex is at the top (−π/2 rotation offset).

#### Scenario: Render polygon
- **WHEN** a POLYGON node with pointCount=3 exists on canvas
- **THEN** an equilateral triangle is rendered within the node's bounding box

#### Scenario: Render star
- **WHEN** a STAR node with pointCount=5 and starInnerRadius=0.38 exists
- **THEN** a 5-pointed star is rendered with inner points at 38% of the outer radius
