# @open-pencil/kiwi

Kiwi schema runtime utilities for OpenPencil.

This package is the future home for scene-graph-agnostic Kiwi parsing, validation, and binary codec helpers. The first split keeps `.fig` import/export policy in `@open-pencil/core` while package-local tests prove the pure Kiwi runtime can build and run independently.

## Checks

```sh
cd packages/kiwi
bun run check
```

Package scripts:

- `bun run test` — package-local Bun tests for schema runtime and Figma schema guards
- `bun run typecheck` — type-checks `src`, tests, and package scripts
- `bun run build` — builds the distributable `dist` entrypoints
- `bun run smoke:dist` — imports built output and exercises the public API
- `bun run check` — runs typecheck, tests, build, and dist smoke in sequence
