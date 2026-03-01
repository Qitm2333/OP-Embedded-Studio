# desktop-app Specification (delta)

## New Requirements

### Requirement: Monorepo with @open-pencil/core
The project SHALL use a Bun workspace monorepo. The engine (scene-graph, renderer, layout, codec, kiwi, types) SHALL be extracted to `packages/core/` (@open-pencil/core) with zero DOM dependencies. The app's `src/engine/` files become re-export shims. Core is importable by CLI, tests, and the app.

#### Scenario: Core has no DOM dependencies
- **WHEN** @open-pencil/core is imported in a Bun/Node environment without browser APIs
- **THEN** it loads successfully
