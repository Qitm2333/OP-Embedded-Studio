## ADDED Requirements

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
