# auto-layout Specification

## Purpose
Flexbox-based auto-layout using Yoga WASM. Frames with auto-layout have children positioned automatically with configurable direction, gap, padding, justify, align, and child sizing.
## Requirements
### Requirement: Yoga WASM layout engine
Auto-layout SHALL use Yoga WASM for flexbox-based layout computation. Frames with auto-layout SHALL have their children positioned by Yoga.

#### Scenario: Horizontal auto-layout
- **WHEN** a frame has stackMode HORIZONTAL with gap 16 and three children
- **THEN** the children are laid out horizontally with 16px between them

### Requirement: Layout properties
Auto-layout frames SHALL support: direction (horizontal/vertical/wrap), gap, padding (uniform and per-side), justify (start/center/end/space-between), align (start/center/end/stretch), and child sizing (fixed/fill/hug).

#### Scenario: Vertical layout with padding
- **WHEN** a frame has stackMode VERTICAL, padding 20, and two children
- **THEN** the children are stacked vertically with 20px padding on all sides

### Requirement: Shift+A toggle
Shift+A SHALL toggle auto-layout on the selected frame. If nodes are selected without a parent frame, Shift+A SHALL wrap them in a new auto-layout frame.

#### Scenario: Toggle auto-layout on frame
- **WHEN** user selects a frame and presses Shift+A
- **THEN** auto-layout is enabled on the frame with default settings

#### Scenario: Wrap selection in auto-layout
- **WHEN** user selects three standalone rectangles and presses Shift+A
- **THEN** the rectangles are wrapped in a new frame with auto-layout enabled

### Requirement: Drag reordering
Within an auto-layout frame, dragging a child SHALL reorder it among siblings with a visual insertion indicator.

#### Scenario: Reorder by drag
- **WHEN** user drags the second child past the third child in an auto-layout frame
- **THEN** the second child moves to position 3 with an insertion line indicating the drop position

### Requirement: Sort by position on wrap
When wrapping selected nodes in auto-layout, nodes SHALL be sorted by their visual position (left-to-right for horizontal, top-to-bottom for vertical).

#### Scenario: Wrap preserves visual order
- **WHEN** three scattered nodes are wrapped in horizontal auto-layout
- **THEN** they are ordered left-to-right based on their X position

### Requirement: Auto-layout properties panel
The properties panel SHALL show auto-layout controls (direction, gap, padding, justify, align, sizing) when an auto-layout frame is selected.

#### Scenario: Properties panel for auto-layout
- **WHEN** user selects a frame with auto-layout enabled
- **THEN** the properties panel shows the Layout section with editable direction, gap, padding, justify, and align controls

