## ADDED Requirements

### Requirement: VitePress documentation site
The project SHALL have a VitePress documentation site in the `docs/` directory with its own `.vitepress/config.ts` configuration, independent from the app's Vite config.

#### Scenario: Docs dev server starts
- **WHEN** `bun run docs:dev` is executed
- **THEN** VitePress dev server starts and serves the documentation site

#### Scenario: Docs build succeeds
- **WHEN** `bun run docs:build` is executed
- **THEN** VitePress produces a static site in `docs/.vitepress/dist/`

### Requirement: Landing page
The docs site SHALL have an index.md landing page with project name, tagline, and quick navigation to guide and reference sections.

#### Scenario: Landing page loads
- **WHEN** user opens the docs site root URL
- **THEN** a landing page with "OpenPencil" title and feature highlights is displayed

### Requirement: Guide section
The docs site SHALL include a guide section with pages: Getting Started, Features, Architecture, Tech Stack.

#### Scenario: Getting started page
- **WHEN** user navigates to the Getting Started guide
- **THEN** installation instructions (`bun install`, `bun run dev`) and desktop app setup are displayed

#### Scenario: Architecture page
- **WHEN** user navigates to the Architecture guide
- **THEN** the system architecture diagram and component descriptions from PLAN.md are displayed

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
The VitePress config SHALL define a sidebar with logical grouping: Guide, Reference, Development.

#### Scenario: Sidebar groups
- **WHEN** user browses any documentation page
- **THEN** a sidebar shows three collapsible groups: Guide, Reference, Development

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
