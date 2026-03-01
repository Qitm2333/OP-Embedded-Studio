# cli Specification

## Purpose
Headless CLI for .fig file operations. Runs in Bun/Node without a GUI, using CanvasKit CPU rasterization for rendering. Lives in packages/cli/ as @open-pencil/cli.

## Requirements

### Requirement: CLI package
@open-pencil/cli SHALL be a separate package in packages/cli/ providing headless .fig file operations. It imports @open-pencil/core for engine access and uses CanvasKit CPU rasterization for rendering without WebGL.

### Requirement: CLI commands
The CLI SHALL support the following commands:
- `open-pencil info <file>` — document stats, node type counts, font list
- `open-pencil tree <file>` — visual node tree with formatted output
- `open-pencil find <file>` — search nodes by name or type
- `open-pencil export <file>` — render to PNG/JPG/WEBP at any scale
- `open-pencil analyze colors <file>` — color palette usage with clustering
- `open-pencil analyze typography <file>` — font/size/weight distribution
- `open-pencil analyze spacing <file>` — gap/padding values with grid alignment check
- `open-pencil analyze clusters <file>` — repeated patterns (potential components)
- `open-pencil node <file> <id>` — detailed properties of a specific node
- `open-pencil pages <file>` — list pages with node counts
- `open-pencil variables <file>` — list design variables and collections

All commands SHALL support `--json` for machine-readable output.

#### Scenario: Info command
- **WHEN** `bun open-pencil info design.fig` is run
- **THEN** document stats, node type counts, and font list are printed

#### Scenario: Export command
- **WHEN** `bun open-pencil export design.fig --format png --scale 2` is run
- **THEN** the document is rendered headlessly and exported as 2× PNG

#### Scenario: JSON output
- **WHEN** `bun open-pencil tree design.fig --json` is run
- **THEN** the node tree is output as JSON

### Requirement: Workspace integration
The CLI SHALL be runnable via `bun open-pencil` within the Bun workspace, without global installation.

#### Scenario: Run from workspace root
- **WHEN** `bun open-pencil info design.fig` is run from the project root
- **THEN** the CLI executes using the workspace-linked binary

### Requirement: Analyze commands
The CLI SHALL provide `open-pencil analyze <file>` subcommands for design file analysis: colors (palette usage with clustering), typography (font/size/weight distribution), spacing (gap/padding values with grid check), clusters (repeated patterns that could be components).

#### Scenario: Analyze colors
- **WHEN** `bun open-pencil analyze colors design.fig` is run
- **THEN** a color palette summary with usage counts and clusters is printed

#### Scenario: Analyze clusters
- **WHEN** `bun open-pencil analyze clusters design.fig` is run
- **THEN** repeated node patterns that could be components are listed

### Requirement: Node command
The CLI SHALL provide `open-pencil node <file> <id>` to display detailed properties of a specific node by ID.

#### Scenario: Node details
- **WHEN** `bun open-pencil node design.fig abc123` is run
- **THEN** the node's type, properties, children, and parent are displayed

### Requirement: Pages command
The CLI SHALL provide `open-pencil pages <file>` to list all pages with node counts.

#### Scenario: List pages
- **WHEN** `bun open-pencil pages design.fig` is run
- **THEN** each page name and its node count are listed

### Requirement: Variables command
The CLI SHALL provide `open-pencil variables <file>` to list design variables and collections.

#### Scenario: List variables
- **WHEN** `bun open-pencil variables design.fig` is run
- **THEN** all variable collections, modes, and variable values are listed
