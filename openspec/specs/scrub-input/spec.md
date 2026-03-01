# scrub-input Specification

## Purpose
Drag-to-scrub numeric input component. Replaces plain number inputs across all property panel sections with drag-to-adjust, click-to-edit, and suffix display capabilities.
## Requirements
### Requirement: Drag-to-scrub numeric input
The ScrubInput component SHALL allow users to drag anywhere on the input field to scrub (adjust) the numeric value. The entire field area SHALL be draggable.

#### Scenario: Drag to increase value
- **WHEN** user clicks and drags right on a ScrubInput with value 100
- **THEN** the value increases proportionally to the drag distance

### Requirement: Click-to-edit mode
Clicking (without dragging) a ScrubInput SHALL enter direct text editing mode where the user can type a numeric value.

#### Scenario: Click to type
- **WHEN** user clicks a ScrubInput without dragging
- **THEN** the input becomes editable and accepts keyboard input

### Requirement: Suffix styling
ScrubInput SHALL support a visual suffix (e.g., "°", "px", "%") displayed after the value.

#### Scenario: Display suffix
- **WHEN** a ScrubInput has suffix "°" and value 45
- **THEN** the input displays "45°"

### Requirement: Used across all numeric properties
ScrubInput SHALL replace plain number inputs in all property panel sections (position, size, rotation, opacity, corner radius, gap, padding, font size, stroke weight).

#### Scenario: Position input uses ScrubInput
- **WHEN** the Position section renders X and Y inputs
- **THEN** they are ScrubInput components with drag-to-scrub behavior

### Requirement: Scrub label hit area
The clickable/draggable area of the scrub label SHALL be properly sized to avoid missing clicks.

#### Scenario: Reliable click target
- **WHEN** user clicks on the scrub label text
- **THEN** the click is registered and scrub mode activates

