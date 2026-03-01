# Design: Sync style runs, JSX renderer, CLI expansion, tests

## Approach
Documentation-only change. Update delta-specs for affected domains, then propagate to VitePress docs and comparison matrix.

## Affected spec domains

1. **text-editing** — rich text style runs (per-selection bold/italic/underline), double/triple-click, selectLine
2. **canvas-rendering** — mixed-style text rendering with ParagraphBuilder.pushStyle/pop
3. **editor-ui** — B/I/U/S toggle buttons in TypographySection
4. **cli** — new commands: analyze (colors/typography/spacing/clusters), node, pages, variables
5. **tooling** — jscpd, kiwi deduplication, kiwi-serialize.ts, test:coverage
6. **testing** — .fig roundtrip tests, LFS fixtures, import performance fix, 27 JSX renderer tests
7. **scene-graph** — JSX renderer (TreeNode builders, renderTreeNode, renderJsx), StyleRun model

## VitePress docs updates
- features.md: add rich text formatting (⌘B/I/U), JSX renderer, expanded CLI commands, double/triple-click
- figma-comparison.md: update text editing notes (style runs, mixed formatting), mark new CLI capabilities
- roadmap.md: add new items to Phase 4/5 delivered

## Risks
- None — documentation only
