# tooling Specification (delta)

## New Requirements

### Requirement: Copy-paste detection
The project SHALL use jscpd for copy-paste detection. The `bun run jscpd` command SHALL scan for duplicated code blocks.

#### Scenario: Detect duplicates
- **WHEN** `bun run jscpd` is run
- **THEN** duplicated code blocks are reported with locations and percentages

### Requirement: Kiwi serialization consolidation
Shared kiwi serialization logic (sceneNodeToKiwi, buildFigKiwi, parseFigKiwiChunks, decompressFigKiwiDataAsync) SHALL be extracted to packages/core/src/kiwi-serialize.ts. The app's src/kiwi/ SHALL re-export from core, eliminating the vendored kiwi-schema copy.

#### Scenario: Clipboard and fig-export share serialization
- **WHEN** clipboard.ts and fig-export.ts serialize nodes to kiwi
- **THEN** both use the shared kiwi-serialize.ts functions

### Requirement: Test coverage script
The project SHALL include a `test:coverage` script for measuring code coverage.

#### Scenario: Run coverage
- **WHEN** `bun run test:coverage` is run
- **THEN** test coverage metrics are reported
