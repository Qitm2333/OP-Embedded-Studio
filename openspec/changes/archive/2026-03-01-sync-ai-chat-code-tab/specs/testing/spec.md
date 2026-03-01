# testing Specification (delta)

## New Requirements

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
