# cli Specification (delta)

## New Requirements

### Requirement: Analyze commands
The CLI SHALL provide `open-pencil analyze <file>` subcommands for design file analysis:
- `analyze colors` — color palette usage with clustering
- `analyze typography` — font/size/weight distribution
- `analyze spacing` — gap/padding values with grid alignment check
- `analyze clusters` — repeated patterns that could be components

All subcommands SHALL support `--json` for machine-readable output.

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
