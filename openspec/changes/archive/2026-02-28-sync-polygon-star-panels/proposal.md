# Proposal: Sync Polygon/Star Tools, Resizable Panels, Code Quality

## Why

12 commits merged from master (af3db9f..70c88dd) introduce new drawing tools, UI improvements, and codebase-wide quality improvements not yet reflected in specs, docs, or Figma comparison matrix.

## What Changes

### New features
1. **Polygon and Star tools** — POLYGON (triangle icon) and STAR (star icon) added to shapes flyout. Renderer draws regular polygons and stars using `pointCount` and `starInnerRadius` SceneNode properties. Polygon defaults to 3 sides, Star to 5 points with 0.38 inner ratio. Flyout shows keyboard shortcuts aligned right.
2. **Resizable panels** — left (layers) and right (properties) panels resizable via reka-ui Splitter. Default 15% width, min 10%, max 30%. Layout persists via auto-save-id. WebGL surface recreation throttled during resize.

### Code quality (no user-facing feature change)
3. **@/ import alias** — all `../` imports rewritten to `@/` paths via vite resolve alias
4. **Type consolidation** — shared types (Vector, Matrix, Rect) moved to `src/types.ts`, Window API declarations to `src/global.d.ts`
5. **Lint/typecheck clean** — 0 warnings, 0 type errors (was 66 + 30+)
6. **oxfmt formatting** — consistent code formatting across codebase
7. **Firefox number spinner fix** — global CSS for hiding spinners
8. **ScrubInput cursor fix** — pointer events moved to container
