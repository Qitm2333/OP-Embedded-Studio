# testing Specification (delta)

## New Requirements

### Requirement: Variable system unit tests
Unit tests SHALL cover the variables system: add and resolve color/number variables, alias chain resolution, circular alias detection, mode switching, bind/unbind to nodes, and removal cleanup.

#### Scenario: Variable tests pass
- **WHEN** `bun test ./tests/engine` is run
- **THEN** all 7 variable tests pass (total 83+ unit tests)
