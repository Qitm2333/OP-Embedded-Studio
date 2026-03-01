# Tasks: Sync style runs, JSX renderer, CLI expansion, tests

Reference: 22 commits from master (33d3def..6268d8b).
Delta-specs in `openspec/changes/sync-style-runs-jsx-cli-tests/specs/` (text-editing, canvas-rendering, editor-ui, cli, tooling, testing, scene-graph).
Proposal: `proposal.md`, Design: `design.md` — validated and aligned with delta-specs.

Section 1 (specs) MUST complete before Section 2 (docs) — docs reference merged spec content.

## 1. Merge Delta-Specs into Main Specs

Each task merges ADDED and MODIFIED requirements from the delta-spec into the baseline at `openspec/specs/<domain>/spec.md`. Untouched baseline requirements are preserved. No conflicts between domains — each delta-spec targets a distinct section of its baseline.

- [x] 1.1 Update `openspec/specs/text-editing/spec.md` — ADDED: "Rich text style runs" (⌘B/I/U per-selection, style preservation on insert/delete), ".fig roundtrip for style runs" (import characterStyleIDs, export deduped table). MODIFIED: "Text selection via mouse drag" (add double-click word, triple-click all), "TextEditor class in core" (add selectLine/selectLineAt)
- [x] 1.2 Update `openspec/specs/canvas-rendering/spec.md` — ADDED: "Mixed-style text rendering" (ParagraphBuilder pushStyle/pop per StyleRun segment)
- [x] 1.3 Update `openspec/specs/editor-ui/spec.md` — ADDED: "Rich text formatting buttons" (B/I/U/S toggles in TypographySection, selection-aware)
- [x] 1.4 Update `openspec/specs/cli/spec.md` — ADDED: "Analyze commands" (colors/typography/spacing/clusters with --json), "Node command" (properties by ID), "Pages command" (list with counts), "Variables command" (collections and values)
- [x] 1.5 Update `openspec/specs/tooling/spec.md` — ADDED: "Copy-paste detection" (jscpd, 15.6%→0.62%), "Kiwi serialization consolidation" (kiwi-serialize.ts shared by clipboard + fig-export), "Test coverage script" (test:coverage)
- [x] 1.6 Update `openspec/specs/testing/spec.md` — ADDED: ".fig roundtrip tests" (LFS fixtures material3/nuxtui, property invariants, encode/decode cycle), ".fig import performance" (O(n²)→O(n), 37s→535ms), "JSX renderer tests" (27 tests)
- [x] 1.7 Update `openspec/specs/scene-graph/spec.md` — ADDED: "StyleRun model" (per-character formatting array on SceneNode), "JSX renderer" (TreeNode builders + renderTreeNode + renderJsx, Tailwind-like shorthand props). These are two independent additions to scene-graph — StyleRun extends the text data model, JSX renderer adds a programmatic creation API

## 2. Update VitePress Docs

All three target files already exist — no sidebar/nav changes needed.

- [x] 2.1 Update `docs/guide/features.md` — modify existing sections and add new ones:
  - **Modify "Inline Text Editing"**: add double-click (word), triple-click (all) to existing paragraph
  - **Add "Rich Text Formatting" section** (after "Inline Text Editing"): ⌘B/I/U toggle per-selection bold/italic/underline, ⌘U for underline, strikethrough via S button in TypographySection, StyleRun model, .fig roundtrip preserves formatting
  - **Add "JSX Renderer" section** (after "@open-pencil/core & CLI"): TreeNode builders (Frame, Text, Rectangle, etc.), Tailwind-like shorthand props (w/h/bg/rounded/flex/gap/p), renderTreeNode() for browser, renderJsx() for CLI/headless via esbuild, 27 tests
  - **Expand CLI commands** in "@open-pencil/core & CLI" section: add analyze (colors/typography/spacing/clusters), node, pages, variables to the list
  - **Add "Code Quality"** section (after "CI/CD Builds"): jscpd copy-paste detection (15.6%→0.62%), kiwi-serialize.ts consolidation, .fig import O(n²) fix (37s→535ms on 87K nodes)
- [x] 2.2 Update `docs/guide/figma-comparison.md` — specific row changes:
  - "Text tool & inline editing" ✅: add "rich text style runs (⌘B/I/U), double/triple-click" to notes
  - "Text styles" 🔲→🟡: "Per-selection bold/italic/underline/strikethrough via ⌘B/I/U and S button; not yet reusable named text styles"
  - "CLI tools" 🟡: add "analyze colors/typography/spacing/clusters, node, pages, variables" to notes
  - No other rows change status. After: 64✅, 16🟡, 70🔲 = 150 total. Update coverage line
- [x] 2.3 Update `docs/development/roadmap.md` — specific phase assignments:
  - **Phase 4 Delivered** (text/rendering): rich text style runs (⌘B/I/U per-selection, StyleRun model, .fig roundtrip), B/I/U/S buttons in TypographySection, double/triple-click text selection
  - **Phase 5 Delivered** (tooling/infra): JSX renderer (TreeNode builders, renderTreeNode/renderJsx, 27 tests), expanded CLI (analyze/node/pages/variables), jscpd (15.6%→0.62%), kiwi-serialize.ts consolidation, .fig roundtrip tests (LFS fixtures), import O(n²) fix, test:coverage script

## 3. Verify

- [x] 3.1 Run `bun run docs:build` — verify build passes. Manually confirm: coverage count in figma-comparison.md matches actual ✅/🟡/🔲 tallies, no broken internal anchor links in output
