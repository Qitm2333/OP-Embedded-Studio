# @open-pencil/fig

`.fig` document policy package for OpenPencil.

This package is currently a scaffold for the next package-split stage. Use `@open-pencil/core` for production `.fig` read/write APIs until behavior moves here.

Planned ownership:

- `.fig` read/write orchestration
- SceneGraph ⇄ Figma NodeChange conversion policy
- raw Figma metadata preservation and invalidation
- component/instance interpretation
- oracle-backed `.fig` fixtures and package-local tests

Non-goals:

- low-level Kiwi schema/runtime/codec internals — use `@open-pencil/kiwi`
- editor actions, renderer behavior, Vue/app UI, CLI formatting, or MCP transport

See `packages/docs/development/fig-package-plan.md` for the staged migration plan.

## Checks

```sh
cd packages/fig
bun run check
```
