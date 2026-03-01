## Why

The project documentation (VitePress at `docs/`) has a comparison page (`docs/guide/comparison.md`) that compares Open Pencil vs Penpot architecturally. There is no systematic feature-by-feature comparison against Figma — the product Open Pencil is cloning. The `../figma-docs` repository contains ~90 articles scraped from Figma's help center covering all Figma Design features. Mapping these against Open Pencil's current capabilities produces summary comparison tables that serve dual purpose: (1) show users/contributors exactly what works today, and (2) act as an implicit roadmap of what's missing.

## What Changes

- Add a new documentation page `docs/guide/figma-comparison.md` with comparison tables organized by Figma's own feature categories
- Each table row maps a Figma feature to Open Pencil's status: ✅ Supported, 🟡 Partial, 🔲 Not yet
- Categories follow Figma's docs structure: Interface, Layers & Shapes, Vector Tools, Text, Color & Fills, Effects & Strokes, Auto Layout, Components & Variables, Prototyping, Import/Export, Collaboration, Dev Mode
- Add navigation entry in VitePress sidebar under Guide
- Cross-reference Figma help center articles so readers can check exact feature scope

## Capabilities

### New Capabilities
- `figma-comparison-docs`: VitePress documentation page with feature-by-feature comparison tables against Figma Design, sourced from figma-docs articles and Open Pencil's existing specs/features

### Modified Capabilities
- `vitepress-docs`: Adding a new page to the sidebar config and navigation

## Impact

- `docs/guide/figma-comparison.md` — new file
- `docs/.vitepress/config.ts` — sidebar entry addition
- No code changes, no runtime impact — documentation only
