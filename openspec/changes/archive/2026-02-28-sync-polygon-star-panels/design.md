# Design: Sync Polygon/Star Tools, Resizable Panels, Code Quality

## Approach

Documentation-only change. Update specs and docs to match already-implemented features.

## Delta-Specs

### editor-ui
- Add Polygon and Star to toolbar tool list
- Add flyout shortcut labels
- Add resizable panels requirement (Splitter)
- Add throttled surface recreation during resize

### scene-graph
- Add `pointCount` and `starInnerRadius` fields to SceneNode
- Add POLYGON/STAR to Tool type

### canvas-rendering
- Add polygon/star rendering requirement (regular polygon path, star inner radius)

### tooling
- Add @/ import alias requirement
- Add shared types module requirement
- Note lint/typecheck clean state (0 warnings, 0 errors)
