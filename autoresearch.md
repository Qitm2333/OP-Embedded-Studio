# Autoresearch: Figma .fig Import Fidelity

## Objective
Minimize the number of node property differences between our .fig file import
and the ground truth from Figma's Plugin API. The benchmark compares visibility,
text content, fill colors, corner radius, and node dimensions on the Preview page
of the Preline UI design system.

## Metrics
- **Primary**: `total_diffs` (count, lower is better) — sum of all property mismatches
- **Secondary**: `visibility`, `text`, `fills`, `radius`, `size`, `unmatched`

## How to Run
```
./autoresearch.sh
```
Outputs `METRIC name=number` lines. Uses `tests/fixtures/gold-preview.fig` as input
and `tests/fixtures/gold-preview-truth.json` as ground truth (extracted from live Figma).

## Files in Scope
- `packages/core/src/kiwi/instance-overrides/` — override resolution pipeline (types, index, populate, resolve, symbol-overrides, sync, props, dsd)
- `packages/core/src/kiwi/kiwi-convert.ts` — main kiwi-to-SceneNode converter
- `packages/core/src/kiwi/kiwi-convert-overrides.ts` — symbolOverride field conversion
- `packages/core/src/kiwi/codec.ts` — NodeChange type definitions
- `packages/core/src/scene-graph.ts` — SceneNode type and defaults
- `packages/core/src/renderer/scene.ts` — render pipeline (clipping, effects)
- `packages/core/src/renderer/shapes.ts` — makeRRect, shape helpers
- `autoresearch-compare.ts` — comparison script (may refine matching logic)

## Off Limits
- `packages/core/src/kiwi/kiwi-schema/` — vendored kiwi codec, do not modify
- Test fixtures (.fig files) — read-only
- Anything in `src/` (app code) — this is a core import fidelity issue

## Constraints
- All 914+ engine tests must pass (`bun run test:unit`)
- Zero lint errors (`bun run lint`)
- No behavior regressions — fixes should be additive

## What's Been Tried
- **Instance swap overrides**: Fixed propagation through clone chains (ef0b45f)
- **Component property defaults**: Empty kiwi value `{}` → reset to initialValue (2cecdff)
- **Text overrides clobbered by second sync**: Added `protect` set (72ec3ee)
- **DSD for swapped instances**: Single-child fallback in resolveOverrideTarget (d93c475)
- **Rounded clipping**: clipRRect when clipsContent + cornerRadius (49423e4)
- **Shadow child shape**: Drop shadow on transparent containers follows first child (f70338d)
- **Current best**: 62 total_diffs (1 vis, 0 text, 11 fills, 0 radius, 50 size, 0 unmatched) — 74.8% improvement
- **kiwiPropertyNodes narrowed**: Only nodes whose fills/radius/visible actually differ from component source (was too broad — any NC with fillPaints)
- **reapplyKiwiProperties failed**: Can't distinguish sync-overwritten from symbolOverride-set fills. Reverted.
- **1 visibility diff root cause**: Email TEXT 0:3480 stays visible because its source 0:3455 IS in seeds (kiwiPropertyNodes) but 0:3452→0:3477 parent sync never runs (0:3477 gets visited by a different sync path first). Needs BFS/skip decoupling.
- **Comparison fixes**: independentCorners radius reading, pill-shape tolerance, name-based tree matching
- **kiwiPropertyNodes**: Nodes with explicit kiwi NC fills/cornerRadius are added to seeds AND protected from sync overwrite
- **Self-referencing symbolOverride**: When an override resolves to the instance itself, skip if the instance has explicit kiwi NC properties
- **SCALE constraint resizing**: Apply proportional scaling to children when instance size ≠ component size; skip auto-layout instances; propagate through clone chains
- **Remaining fills (11)**: Variable-bound colors (3 Indicators, 1 Ellipse), deep chain color overrides (3 badge Placeholders, 1 Link, 1 Vector, 1 button Placeholder, 1 Left Divider)
- **Remaining sizes (50)**: 16 Vectors (Badge 1.12x ratio), 7 datepicker widths, 3+3+3 Badge/Avatar/Placeholder sizing (layout-dependent), 4 Groups, misc text widths
- **Root causes of remaining diffs**:
  - **Fills (11)**: ALL fill overrides use `colorVar` library aliases. The `paint.color` is the fallback value, but the alias resolves to a different color in context. Need library asset ref → local variable mapping via `variableConsumptionMap`.
  - **Sizes (50)**: 30+ are Badge area (~1.12x ratio from layout-dependent width), 7 datepicker (layout), rest are text measurement diffs. These need pixel-perfect text measurement or DSD propagation improvements.
