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
- **Current best**: 84 total_diffs (1 vis, 0 text, 9 fills, 0 radius, 74 size, 99 unmatched)
- **Comparison fixes**: independentCorners radius reading, pill-shape tolerance
- **kiwiPropertyNodes**: Nodes with explicit kiwi NC fills/cornerRadius are added to seeds AND protected from sync overwrite
- **Self-referencing symbolOverride**: When an override resolves to the instance itself, skip if the instance has explicit kiwi NC properties
- **Remaining fills (9)**: Variable-bound colors (Indicators), wrong variant selection (badge Placeholders), deep chain overrides
- **Remaining sizes (74)**: 38 Vector constraint resizing (no DSD size data), 6 datepicker layout widths, Badge proportional scaling
- **Unmatched (99)**: Tree path matching gaps in deep clone chains
