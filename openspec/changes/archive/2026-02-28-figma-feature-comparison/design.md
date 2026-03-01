## Context

The `../figma-docs` repo has ~90 Figma help center articles organized into categories: Tour the Interface, Create Designs (layers, vectors, text, colors, auto layout, properties), Figma Draw, Build Design Systems (styles, components, variables, libraries), Dev Mode, Create Prototypes, Import/Export, Work Together. Open Pencil's current features are documented in `docs/guide/features.md` and codified in 20 openspec specs. The existing `docs/guide/comparison.md` only compares against Penpot.

## Goals / Non-Goals

**Goals:**
- Single authoritative page mapping every Figma Design feature area to Open Pencil status
- Tables grouped by Figma's own documentation categories for intuitive navigation
- Three-tier status system: ✅ Supported, 🟡 Partial, 🔲 Not yet — with brief notes
- VitePress sidebar integration under Guide section

**Non-Goals:**
- Not replicating Figma's docs content — just referencing feature names
- Not covering Figma-specific SaaS features (team management, billing, organization admin)
- Not covering FigJam or Figma Slides — only Figma Design
- Not implementing any missing features — this is documentation only

## Decisions

### 1. Table structure: category → feature → status → notes

Each category from Figma's docs becomes a `###` heading with a markdown table. Columns: Feature | Status | Notes. This is the simplest structure that VitePress renders well and is easy to maintain.

Alternative considered: one giant flat table. Rejected — too long, harder to scan.

### 2. Feature granularity: one row per Figma help article (roughly)

Some articles cover multiple sub-features (e.g., "Explore text properties" covers font, size, weight, alignment, etc.). In those cases, split into meaningful rows where Open Pencil may have partial coverage. But don't go deeper than what's useful — keep it ~80-100 rows total.

### 3. Status assessment methodology

Map features by cross-referencing:
- Figma docs articles → what the feature does
- Open Pencil specs (`openspec/specs/*/spec.md`) → what's been specified
- Open Pencil features (`docs/guide/features.md`) → what's been built
- Source code if ambiguous

### 4. Sidebar placement

Add `figma-comparison` after `comparison` (Penpot) in the Guide section. Title: "Figma Feature Matrix".

## Risks / Trade-offs

- [Staleness] Tables become outdated as features are implemented → Add a note at the top with last-updated date; updating the table should be part of future feature completion workflows
- [Subjectivity] "Partial" vs "Not yet" can be debatable → Use "Partial" only when the core behavior exists but edge cases or advanced options are missing
