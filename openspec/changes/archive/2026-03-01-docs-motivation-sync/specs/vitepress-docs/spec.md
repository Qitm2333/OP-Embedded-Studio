## MODIFIED Requirements

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

### Requirement: Comparison page
The docs site SHALL include a comparison page at `/guide/comparison` documenting architecture, rendering, data model, layout, file format, state management, developer experience, and performance differences between OpenPencil and Penpot. The intro SHALL reference the motivation for an open alternative to closed design platforms.

#### Scenario: Comparison page renders
- **WHEN** user navigates to /guide/comparison
- **THEN** a page with all comparison sections, the summary table, and a motivation context intro is displayed
