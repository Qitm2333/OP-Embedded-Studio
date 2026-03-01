# Tasks: Sync Polygon/Star Tools, Resizable Panels, Code Quality

Reference: 12 commits from master (af3db9f..70c88dd).

## 1. Merge Delta-Specs into Main Specs

- [x] 1.1 Update `openspec/specs/editor-ui/spec.md` — add Polygon/Star to toolbar tool list in "Bottom toolbar" requirement, add flyout shortcut labels. Add "Resizable panels" requirement (Splitter, 15% default, 10–30% range, persist). Add "Throttled WebGL surface recreation" requirement.
- [x] 1.2 Update `openspec/specs/scene-graph/spec.md` — add `pointCount` and `starInnerRadius` fields. Add POLYGON/STAR to Tool type. Note flyout-only (no keyboard shortcut).
- [x] 1.3 Update `openspec/specs/canvas-rendering/spec.md` — add polygon/star rendering requirement (regular polygon path from pointCount, star inner radius, fill/stroke/hover/selection support).
- [x] 1.4 Update `openspec/specs/tooling/spec.md` — add @/ import alias requirement, shared types module (src/types.ts, src/global.d.ts), zero lint/type error maintenance requirement.

## 2. Update VitePress Docs

- [x] 2.1 Update `docs/guide/features.md` — add "Shape Tools" section covering all drawing tools including Polygon and Star. Update "Properties Panel" to mention resizable panels. Mention @/ import alias in Desktop App or add brief code quality note.
- [x] 2.2 Update `docs/guide/figma-comparison.md` — update "Shape tools" row notes to mention Polygon/Star with pointCount and starInnerRadius. Add resizable panels note under "Layers panel" or "Properties panel" rows. Update coverage count and date.
- [x] 2.3 Update `docs/reference/keyboard-shortcuts.md` — add Polygon and Star tools (no shortcut, flyout only) to Tools table.
- [x] 2.4 Update `docs/development/roadmap.md` — add Polygon/Star tools, resizable panels, @/ alias, type consolidation, lint-clean codebase to Phase 4 Delivered.

## 3. Verify

- [x] 3.1 Run `bun run docs:build` to verify VitePress build passes.
