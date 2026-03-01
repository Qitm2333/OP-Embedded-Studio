# rulers Specification

## Purpose
Canvas rulers at top and left edges showing coordinate scales. Displays selection highlight bands, coordinate badges at selection bounds, and can be disabled via URL parameter.
## Requirements
### Requirement: Canvas rulers
Horizontal and vertical rulers SHALL be displayed at the top and left edges of the canvas, showing coordinate scales that update with pan/zoom.

#### Scenario: Ruler display
- **WHEN** the editor loads
- **THEN** horizontal and vertical rulers are visible with tick marks and coordinate labels

### Requirement: Selection highlight on rulers
Rulers SHALL display a highlight band at the position/size of the current selection.

#### Scenario: Selection ruler highlight
- **WHEN** a 200px wide node at X=100 is selected
- **THEN** the horizontal ruler shows a translucent highlight band from 100 to 300

### Requirement: Coordinate badges
Rulers SHALL display coordinate badges at the selection's start and end positions.

#### Scenario: Coordinate badges
- **WHEN** a node spanning X 100-300, Y 50-200 is selected
- **THEN** coordinate badges show 100 and 300 on the horizontal ruler, 50 and 200 on the vertical ruler

### Requirement: Consistent text alignment
Ruler tick labels and badge text SHALL align to the same baseline for visual consistency.

#### Scenario: Label alignment
- **WHEN** rulers render tick labels and coordinate badges
- **THEN** text baselines are aligned consistently across ticks and badges

### Requirement: Vertical ruler text clipping
Vertical ruler text SHALL NOT clip or overflow outside the ruler bounds.

#### Scenario: Vertical ruler overflow
- **WHEN** the vertical ruler displays coordinate labels
- **THEN** no text is clipped or extends beyond the ruler's visible area

### Requirement: Rulers can be disabled
The URL parameter `?no-rulers` SHALL disable canvas rulers for testing or presentation.

#### Scenario: Disable rulers via URL
- **WHEN** the editor loads with `?no-rulers` in the URL
- **THEN** rulers are not rendered

