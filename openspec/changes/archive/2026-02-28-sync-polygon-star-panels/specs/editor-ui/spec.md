# editor-ui Specification (delta)

## Modified Requirements

### Requirement: Bottom toolbar (updated)
The toolbar SHALL include Polygon and Star in the shapes flyout alongside Rectangle, Line, and Ellipse. The flyout dropdown SHALL show keyboard shortcuts right-aligned for each tool (R, L, O). POLYGON and STAR are flyout-only — no dedicated keyboard shortcuts.

#### Scenario: Polygon tool in flyout
- **WHEN** user opens the shapes flyout
- **THEN** Polygon (triangle icon) and Star (star icon) are listed with other shape tools

#### Scenario: Draw polygon on canvas
- **WHEN** user selects Polygon tool and drags on canvas
- **THEN** a POLYGON node is created with default 3 sides

#### Scenario: Draw star on canvas
- **WHEN** user selects Star tool and drags on canvas
- **THEN** a STAR node is created with 5 points and 0.38 inner radius

## New Requirements

### Requirement: Resizable panels
The left (layers) and right (properties) panels SHALL be resizable via reka-ui Splitter components (SplitterGroup, SplitterPanel, SplitterResizeHandle). Default width: 15%, min: 10%, max: 30%. Layout SHALL persist across reloads via auto-save-id. Resize handle highlights blue on hover. The 8px-wide handle uses negative margins with a centered 1px visible line.

#### Scenario: Resize layers panel
- **WHEN** user drags the resize handle between layers panel and canvas
- **THEN** the layers panel width changes and the canvas resizes accordingly

#### Scenario: Panel size persists
- **WHEN** user resizes panels and reloads the page
- **THEN** panel widths are restored to the previous sizes

### Requirement: Throttled WebGL surface recreation
The CanvasKit surface SHALL be recreated at most once per animation frame during panel resize, coalesced via requestAnimationFrame in the ResizeObserver callback.

#### Scenario: Panel resize performance
- **WHEN** user drags a panel resize handle continuously
- **THEN** the WebGL surface is recreated at most once per frame, not on every ResizeObserver tick
