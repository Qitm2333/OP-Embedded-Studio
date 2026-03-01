## ADDED Requirements

### Requirement: Pan with space+drag
The canvas SHALL support panning via space+drag, middle mouse drag, and two-finger trackpad gestures.

#### Scenario: Space+drag pan
- **WHEN** user holds space and drags on the canvas
- **THEN** the viewport pans by the drag delta

### Requirement: Zoom with scroll
The canvas SHALL support zooming via ctrl+scroll (or pinch) toward the cursor position, and via keyboard shortcuts ⌘= (zoom in), ⌘- (zoom out), ⌘0 (100%).

#### Scenario: Ctrl+scroll zoom
- **WHEN** user ctrl+scrolls up on the canvas
- **THEN** the viewport zooms in centered on the cursor position

#### Scenario: Keyboard zoom
- **WHEN** user presses ⌘0
- **THEN** the viewport resets to 100% zoom level

### Requirement: Pinch-to-zoom isolation
Browser pinch-to-zoom SHALL be prevented on UI panels while allowing canvas pinch-to-zoom.

#### Scenario: Pinch on panel
- **WHEN** user performs a pinch gesture on the properties panel
- **THEN** the browser zoom does not change

### Requirement: Hand tool
Pressing H SHALL activate the hand tool for continuous panning without holding space.

#### Scenario: Hand tool activation
- **WHEN** user presses H
- **THEN** the hand tool is active and any drag pans the canvas
