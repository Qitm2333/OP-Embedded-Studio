## Context

39 commits landed since the baseline specs and VitePress docs were created. The specs in `openspec/specs/` and docs in `docs/` are now behind the actual implementation. This is a documentation-only catchup change.

## Goals / Non-Goals

**Goals:**
- Add requirements/scenarios to 9 existing specs covering all new functionality
- Update all affected VitePress doc pages with accurate feature descriptions
- Keep specs and docs as the source of truth for the current state

**Non-Goals:**
- No source code changes
- No new specs — all new features map to existing capability domains
- No new doc pages — updates to existing ones

## Decisions

### Delta-spec approach for all 9 modified capabilities
Each modified spec gets a delta-spec in `specs/<name>/spec.md` that adds new requirements. On archive, these merge into the baseline specs.

### Docs updates derived from spec changes
Each spec update implies a corresponding docs update. The mapping:
- `scene-graph` → node-types.md, scene-graph.md
- `canvas-rendering` → features.md, architecture.md
- `editor-ui` → features.md, keyboard-shortcuts.md
- `fig-import` → file-format.md, features.md, keyboard-shortcuts.md
- `desktop-app` → features.md
- `testing` → testing.md
- `vitepress-docs` → roadmap.md

### Feature categorization
Group new features by commit clusters:
1. Sections (cadbd13..55c3ea3): SECTION node type, title pills, auto-adopt
2. Pages (1d79473..fd2e38e): multi-page, PagesPanel, viewport per page
3. Hover highlight (b10d427, adc95c7): shape-aware outlines
4. .fig export (086fb7d..edf6da6): Save/SaveAs, Kiwi encode, Zstd Rust, thumbnail
5. Rendering tier 1 (e2e0e75): gradients, images, effects, strokes, arcs
6. Fill picker (cf454a8): solid/gradient/image tabs, gradient stops
7. Tests (07f0f55, 27f83c7, layers-panel E2E): fig-import, layout, E2E

## Risks / Trade-offs

- [Spec count accuracy] Some features (like new NodeType variants) only need a mention in existing requirements rather than separate requirements → Keep granularity consistent with baseline
- [Docs staleness] Future commits will continue to drift → This is expected; periodic catchup changes are the workflow
