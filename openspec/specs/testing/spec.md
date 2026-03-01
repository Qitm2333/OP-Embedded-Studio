# testing Specification

## Purpose
Test infrastructure. Playwright visual regression (E2E with Figma CDP reference), bun:test unit tests, no-chrome test mode, data-ready synchronization, and page reuse optimization.
## Requirements
### Requirement: Playwright visual regression testing
E2E tests SHALL use Playwright to create shapes and compare screenshots against baseline snapshots.

#### Scenario: Visual regression test pass
- **WHEN** `bun run test` is executed
- **THEN** Playwright tests create shapes, take screenshots, and compare against baseline PNGs

### Requirement: Figma CDP reference tests
A separate Playwright project SHALL connect to Figma via Chrome DevTools Protocol (CDP) to capture reference screenshots for pixel-perfect comparison.

#### Scenario: Figma reference capture
- **WHEN** `bun run test:figma` is executed with Figma running in debug mode
- **THEN** Playwright connects to Figma via CDP and captures reference screenshots

### Requirement: No-chrome test mode
The editor SHALL support a test mode (activated via URL param or environment) that hides Chrome/UI elements for clean screenshot capture.

#### Scenario: Test mode rendering
- **WHEN** the editor loads in test mode
- **THEN** only canvas content is rendered, without toolbar, panels, or other UI chrome

### Requirement: Data-ready optimization
The editor SHALL signal readiness via a `data-ready` attribute for E2E test synchronization, replacing unreliable timeouts.

#### Scenario: Wait for ready
- **WHEN** a Playwright test waits for the data-ready attribute
- **THEN** it proceeds only when the canvas is fully rendered

### Requirement: Page reuse for speed
E2E tests SHALL reuse the browser page across test cases to minimize overhead. Target: all E2E tests complete in <3s.

#### Scenario: Fast E2E execution
- **WHEN** the full E2E test suite runs
- **THEN** it completes in under 3 seconds by reusing the page

### Requirement: bun:test unit tests
Engine unit tests SHALL use bun:test and complete in <50ms.

#### Scenario: Unit test speed
- **WHEN** `bun test ./tests/engine` is run
- **THEN** all unit tests pass in under 50ms

### Requirement: Fig-import unit tests
Unit tests SHALL verify the .fig import pipeline: node type mapping, transform extraction, fill/stroke/effect import, gradient stops, image fills, arc data, stroke properties, and nested frame hierarchies.

#### Scenario: Run fig-import tests
- **WHEN** `bun test ./tests/engine/fig-import.test.ts` is executed
- **THEN** all import pipeline tests pass covering tier 1 rendering features

### Requirement: Layout unit tests
Unit tests SHALL verify Yoga auto-layout computation: direction, gap, padding, justify, align, child sizing (fixed/fill/hug), cross-axis sizing, wrap, and nested layouts.

#### Scenario: Run layout tests
- **WHEN** `bun test ./tests/engine/layout.test.ts` is executed
- **THEN** all layout computation tests pass

### Requirement: Layers panel E2E tests
E2E tests SHALL verify the layers panel: node visibility in tree, expand/collapse frames, selection sync between canvas and layers panel.

#### Scenario: Run layers panel E2E
- **WHEN** the layers panel E2E tests run
- **THEN** all tests pass verifying tree structure, visibility toggles, and selection sync

### Requirement: Component-instance sync unit tests
Unit tests SHALL cover the component-instance sync lifecycle: instance creation with `componentId` mapping on children, sync propagation of property changes, override preservation during sync, new child addition to instances, and detach breaking the link.

#### Scenario: Instance child mapping test
- **WHEN** `bun test ./tests/engine/scene-graph.test.ts` runs
- **THEN** the test verifies instance children have `componentId` pointing to component children

#### Scenario: Sync propagation test
- **WHEN** a component's text child changes and sync is triggered
- **THEN** the test verifies instance children receive the updated text and fontSize

#### Scenario: Override preservation test
- **WHEN** an instance child has an overridden text value
- **THEN** the test verifies the override is preserved while non-overridden properties sync

#### Scenario: New child addition test
- **WHEN** a new child is added to a component and sync runs
- **THEN** the test verifies existing instances gain the new child

#### Scenario: Detach test
- **WHEN** an instance is detached
- **THEN** the test verifies type becomes FRAME, componentId is null, and the component's instance list no longer includes it

### Requirement: Variable system unit tests
Unit tests SHALL cover the variables system: add and resolve color/number variables, alias chain resolution, circular alias detection (returns undefined), mode switching, bind/unbind to nodes, and variable removal cleanup. Total: 7 variable tests in a "Variables" describe block.

#### Scenario: Variable tests pass
- **WHEN** `bun test ./tests/engine` is run
- **THEN** all variable tests pass (add/resolve color, resolve number, alias chain, circular alias, mode switching, bind/unbind, removal cleanup)


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
The test suite SHALL include tests for the JSX renderer covering all node types (Frame, Text, Rectangle, Ellipse, etc.), layout props, effects, and nesting. Currently 27 tests.

#### Scenario: Render Frame with children
- **WHEN** a JSX tree with Frame containing Rectangle and Text is rendered
- **THEN** the scene graph contains correct parent-child relationships and properties

### Requirement: AI chat Playwright tests
The test suite SHALL include Playwright e2e tests for the AI chat panel with mock transport (no real LLM calls). Tests cover: sending a message, receiving a response, tool call display. Real LLM tests available via TEST_REAL_LLM=1 flag.

#### Scenario: Chat with mock transport
- **WHEN** a Playwright test sends a message via the chat input
- **THEN** the mock transport returns a response and the message appears in the chat

### Requirement: JSX export tests
The test suite SHALL include tests for sceneNodeToJsx() covering shapes, text, layout props, effects, and multi-selection. Currently 14 tests.

#### Scenario: Export rectangle to JSX
- **WHEN** sceneNodeToJsx is called on a rectangle with blue fill
- **THEN** the output includes Rectangle component with bg prop
