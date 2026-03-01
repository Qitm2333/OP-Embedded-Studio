## ADDED Requirements

### Requirement: Fig-import unit tests
Unit tests SHALL verify the .fig import pipeline: node type mapping, transform extraction, fill/stroke/effect import, gradient stops, image fills, arc data, stroke properties, and nested frame hierarchies.

#### Scenario: Run fig-import tests
- **WHEN** `bun test ./tests/engine/fig-import.test.ts` is executed
- **THEN** all import pipeline tests pass covering tier 1 rendering features

### Requirement: Layout unit tests
Unit tests SHALL verify Yoga auto-layout computation: direction, gap, padding, justify, align, child sizing (fixed/fill/hug), cross-axis sizing, wrap, and nested layouts.

#### Scenario: Run layout tests
- **WHEN** `bun test ./tests/engine/layout.test.ts` is executed
- **THEN** all layout computation tests pass

### Requirement: Layers panel E2E tests
E2E tests SHALL verify the layers panel: node visibility in tree, expand/collapse frames, selection sync between canvas and layers panel.

#### Scenario: Run layers panel E2E
- **WHEN** the layers panel E2E tests run
- **THEN** all tests pass verifying tree structure, visibility toggles, and selection sync
