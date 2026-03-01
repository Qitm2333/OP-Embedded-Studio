# canvas-rendering Specification (delta)

## New Requirements

### Requirement: Variable binding resolution in renderer
The renderer SHALL resolve variable bindings before painting fills and strokes. When a fill or stroke has a bound variable, the renderer resolves the variable value using the collection's active mode and uses the resolved color.

#### Scenario: Render bound fill
- **WHEN** a rectangle's fill is bound to a COLOR variable with value red in Light mode
- **THEN** the rectangle renders with red fill

### Requirement: Image export rendering
The renderer SHALL support offscreen rendering to PNG, JPG, and WEBP via renderNodesToImage. Export uses an offscreen CanvasKit surface at the specified scale. JPG renders with opaque white background, PNG and WEBP render with transparency. Re-encoding for JPG/WEBP uses OffscreenCanvas.

#### Scenario: Export at 2× scale
- **WHEN** a 100×100 node is exported at 2× scale as PNG
- **THEN** the output image is 200×200 pixels with transparency

### Requirement: Scene version vs render version
The renderer SHALL distinguish between scene changes (increments sceneVersion + renderVersion) and viewport-only changes like pan/zoom (increments renderVersion only). UI panels and export preview observe sceneVersion to avoid unnecessary updates during navigation. This prevents export preview flicker on pan/zoom.

#### Scenario: Pan does not trigger export preview update
- **WHEN** user pans the canvas
- **THEN** sceneVersion does not change, so export preview is not re-rendered
