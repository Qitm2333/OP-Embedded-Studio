# tooling Specification (delta)

## Modified Requirements

### Requirement: Bun workspace monorepo (updated)
The project SHALL use Bun workspaces with packages: root (app), packages/core (@open-pencil/core), packages/cli (@open-pencil/cli). The workspace is configured in the root package.json. CLI is runnable via `bun open-pencil` in the workspace.

### Requirement: npm publishing preparation
@open-pencil/core and @open-pencil/cli SHALL have proper package.json fields for npm publishing: name, version, description, exports, main, types, files, license, repository.

#### Scenario: Core package.json is valid
- **WHEN** `npm pack --dry-run` is run in packages/core
- **THEN** the package includes the correct files and metadata
