# testing Specification (delta)

## New Requirements

### Requirement: .fig roundtrip tests
The test suite SHALL include roundtrip tests for real .fig files: parsing property invariants, encode/decode cycle fidelity. Test fixtures (material3.fig, nuxtui.fig) SHALL be tracked via Git LFS.

#### Scenario: Roundtrip encode/decode
- **WHEN** a .fig file is parsed and re-encoded
- **THEN** the re-encoded data decodes to the same node properties

#### Scenario: Property invariants
- **WHEN** a real .fig file is parsed
- **THEN** all nodes have valid types, dimensions ≥ 0, and required fields present

### Requirement: .fig import performance
The .fig import pipeline SHALL avoid O(n²) child resolution. A children index SHALL be built upfront for linear-time lookups.

#### Scenario: Large file import speed
- **WHEN** material3.fig (87K nodes) is imported
- **THEN** parsing completes in under 2 seconds (was 37s before fix)

### Requirement: JSX renderer tests
The test suite SHALL include tests for the JSX renderer covering all node types (Frame, Text, Rectangle, Ellipse, etc.), layout props, effects, and nesting.

#### Scenario: Render Frame with children
- **WHEN** a JSX tree with Frame containing Rectangle and Text is rendered
- **THEN** the scene graph contains correct parent-child relationships and properties
