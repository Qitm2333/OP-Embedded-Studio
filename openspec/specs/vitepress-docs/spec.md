# vitepress-docs Specification

## Purpose
VitePress documentation site at `docs/` with content derived from PLAN.md, README, and openspec specs. Includes guide pages (getting started, architecture, tech stack), reference pages (keyboard shortcuts, node types, MCP tools), and development pages (contributing, testing, openspec workflow, roadmap).
## Requirements
### Requirement: VitePress documentation site
The project SHALL have a VitePress documentation site in the `docs/` directory with its own `.vitepress/config.ts` configuration, independent from the app's Vite config.

#### Scenario: Docs dev server starts
- **WHEN** `bun run docs:dev` is executed
- **THEN** VitePress dev server starts and serves the documentation site

#### Scenario: Docs build succeeds
- **WHEN** `bun run docs:build` is executed
- **THEN** VitePress produces a static site in `docs/.vitepress/dist/`

### Requirement: Landing page
The docs site SHALL have an index.md landing page with project name, tagline "Open-source Figma alternative. Fully local, AI-native, programmable.", and quick navigation to guide and reference sections. The feature cards SHALL reflect the five pillars: open source, Figma-compatible, AI-native, fully local, programmable.

#### Scenario: Landing page loads
- **WHEN** user opens the docs site root URL
- **THEN** a landing page with "OpenPencil" title, the updated tagline, and pillar-based feature highlights is displayed

### Requirement: Guide section
The docs site SHALL include a guide section with pages: Getting Started, Features, Architecture, Tech Stack. The Features page SHALL begin with a brief motivation section explaining why OpenPencil exists (open platform vs closed tooling). The Features page SHALL document components (create, instance, detach, component sets), context menu, z-order, visibility/lock toggle, move-to-page, and rendering optimizations (viewport culling, RAF coalescing).

#### Scenario: Getting started page
- **WHEN** user navigates to the Getting Started guide
- **THEN** installation instructions (`bun install`, `bun run dev`) and desktop app setup are displayed

#### Scenario: Architecture page
- **WHEN** user navigates to the Architecture guide
- **THEN** the system architecture diagram and component descriptions from PLAN.md are displayed

#### Scenario: Features page motivation section
- **WHEN** user reads the features page
- **THEN** a brief intro explains why OpenPencil exists before the feature list

#### Scenario: Features page documents components
- **WHEN** user reads the features page
- **THEN** component creation, instances, detach, component sets, and context menu are described

### Requirement: Reference section
The docs site SHALL include a reference section with pages: Keyboard Shortcuts, Node Types, MCP Tools, Scene Graph, File Format.

#### Scenario: Keyboard shortcuts page
- **WHEN** user navigates to Keyboard Shortcuts reference
- **THEN** the full shortcut table from PLAN.md is displayed with implementation status

#### Scenario: MCP tools page
- **WHEN** user navigates to MCP Tools reference
- **THEN** all 117 MCP tools are listed grouped by category

### Requirement: Development section
The docs site SHALL include a development section with pages: Contributing, Testing, OpenSpec Workflow, Roadmap.

#### Scenario: Roadmap page
- **WHEN** user navigates to the Roadmap development page
- **THEN** the 6 phases from PLAN.md are listed with current progress

### Requirement: Sidebar navigation
The VitePress config SHALL define a sidebar with logical grouping: User Guide, Guide, Reference, Development. The User Guide group SHALL appear first and include entries for all user guide articles. The Guide group SHALL include a "Figma Feature Matrix" entry after "Comparison" linking to `/guide/figma-comparison`.

#### Scenario: Sidebar groups
- **WHEN** user browses any documentation page
- **THEN** a sidebar shows four collapsible groups: User Guide, Guide, Reference, Development

#### Scenario: User Guide sidebar entries
- **WHEN** user views the User Guide sidebar section
- **THEN** entries for all 12 user guide articles are listed in logical order

#### Scenario: Figma comparison in sidebar
- **WHEN** user views the Guide sidebar section
- **THEN** a "Figma Feature Matrix" entry appears after "Comparison" linking to `/guide/figma-comparison`

### Requirement: Dark theme
The docs site SHALL use dark appearance to match the editor's dark aesthetic.

#### Scenario: Dark mode
- **WHEN** user opens the documentation site
- **THEN** the site renders with VitePress dark theme

### Requirement: Build artifacts excluded from git
`docs/.vitepress/dist` and `docs/.vitepress/cache` SHALL be listed in `.gitignore`.

#### Scenario: Gitignore entries
- **WHEN** `bun run docs:build` creates output in `docs/.vitepress/dist/`
- **THEN** the output directory is not tracked by git

### Requirement: Docs reflect sections feature
The features page SHALL document sections: SECTION node type, title pills, auto-adopt siblings, top-level-only constraint.

#### Scenario: Sections described in features
- **WHEN** user reads the features page
- **THEN** sections are documented with their behavior

### Requirement: Docs reflect multi-page support
The features page SHALL document multi-page documents: add/delete/rename pages, per-page viewport, pages panel.

#### Scenario: Pages described in features
- **WHEN** user reads the features page
- **THEN** multi-page support is documented

### Requirement: Docs reflect .fig export
The file-format page SHALL document .fig export: Save/Save As, Kiwi encoding, Zstd compression, thumbnail generation. The features page SHALL list .fig export as a capability.

#### Scenario: Export documented in file-format
- **WHEN** user reads the file-format reference
- **THEN** the export pipeline and supported formats table shows .fig export ✅

### Requirement: Docs reflect advanced rendering
The features page SHALL document tier 1 rendering: gradients, image fills, effects (shadows, blurs), stroke properties (cap, join, dash), arcs.

#### Scenario: Rendering features documented
- **WHEN** user reads the features page
- **THEN** gradient fills, image fills, effects, and stroke properties are described

### Requirement: Docs reflect updated keyboard shortcuts
The keyboard shortcuts page SHALL mark Section tool (S), Save (⌘S), Save As (⇧⌘S), Create Component (⌥⌘K), Detach Instance (⌥⌘B), Create Component Set (⇧⌘K), Bring to Front (]), Send to Back ([), Toggle Visibility (⇧⌘H), and Toggle Lock (⇧⌘L) as implemented (✅).

#### Scenario: New shortcuts marked
- **WHEN** user reads the keyboard shortcuts page
- **THEN** ⌥⌘K, ⌥⌘B, ⇧⌘K, ], [, ⇧⌘H, ⇧⌘L show ✅ status

### Requirement: Docs reflect updated node types
The node-types reference SHALL list the current 17 types in the NodeType union used by the scene graph.

#### Scenario: Node types are current
- **WHEN** user reads the node types page
- **THEN** CANVAS, ROUNDED_RECTANGLE, COMPONENT, COMPONENT_SET, INSTANCE, CONNECTOR, SHAPE_WITH_TEXT are all listed

### Requirement: Roadmap reflects current progress
The roadmap page SHALL reflect that .fig export, sections, pages, hover highlight, and advanced rendering are delivered (Phase 3). Phase 4 SHALL show as 🟡 In Progress with component creation, instances, component sets, and detach delivered.

#### Scenario: Roadmap is current
- **WHEN** user reads the roadmap page
- **THEN** Phase 3 shows delivered items and Phase 4 shows partial progress with component features

### Requirement: Comparison page
The docs site SHALL include a comparison page at `/guide/comparison` documenting architecture, rendering, data model, layout, file format, state management, developer experience, and performance differences between OpenPencil and Penpot. The intro SHALL reference the motivation for an open alternative to closed design platforms.

#### Scenario: Comparison page renders
- **WHEN** user navigates to /guide/comparison
- **THEN** a page with all comparison sections, the summary table, and a motivation context intro is displayed

### Requirement: Comparison in sidebar navigation
The VitePress sidebar SHALL include a "Comparison" link in the Guide section after Tech Stack.

#### Scenario: Sidebar shows comparison
- **WHEN** user views the Guide sidebar
- **THEN** a "Comparison" entry appears after "Tech Stack" linking to /guide/comparison

