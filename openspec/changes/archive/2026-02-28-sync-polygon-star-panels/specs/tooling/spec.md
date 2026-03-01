# tooling Specification (delta)

## New Requirements

### Requirement: @/ import alias
The project SHALL configure a `@/` → `src/` path alias in both `vite.config.ts` (resolve.alias) and `tsconfig.json` (paths). All cross-directory imports SHALL use `@/` instead of relative `../` paths. Same-directory `./` imports are kept as-is.

#### Scenario: Import with alias
- **WHEN** a component in `src/components/` imports from `src/engine/`
- **THEN** the import uses `@/engine/` instead of `../../engine/`

### Requirement: Shared types module
Shared primitive types (Vector, Matrix, Rect) SHALL be defined in `src/types.ts` and imported across the codebase. Window API declarations (File System Access, queryLocalFonts) SHALL be in `src/global.d.ts`. Inline duplicates SHALL be eliminated.

#### Scenario: Shared Vector type
- **WHEN** multiple files need a 2D point type
- **THEN** they import `Vector` from `@/types` instead of defining their own

### Requirement: Zero lint and type errors
The codebase SHALL maintain 0 oxlint warnings and 0 tsgo type errors. `bun run check` SHALL pass cleanly.

#### Scenario: Clean check
- **WHEN** `bun run check` is executed
- **THEN** both lint and typecheck pass with zero issues
