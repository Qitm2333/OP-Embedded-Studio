# Contributing

## Setup

```bash
git clone https://github.com/open-pencil/open-pencil.git
cd open-pencil
bun install
```

## Development

```bash
bun run dev          # Vite dev server on localhost:1420
bun run tauri dev    # Tauri desktop app with hot reload
```

## Quality checks

Run all of these before submitting a PR:

```bash
bun run check        # oxlint + typecheck
bun run format       # oxfmt with import sorting
bun run test:dupes   # jscpd < 3% duplication
bun test tests/engine/  # unit tests
bun run test         # Playwright E2E (requires dev server)
```

## Project structure

- `packages/core` — scene graph, renderer, layout, codec (zero DOM deps)
- `packages/cli` — headless CLI for .fig inspection and export
- `packages/mcp` — MCP server for AI tools (stdio + HTTP)
- `src/` — Tauri/Vite desktop editor

## Conventions

- Bun runtime, not Node
- Tailwind 4 for styles, no inline CSS or `<style>` blocks
- No `any`, no `!` non-null assertions
- `@/` import alias for app code, relative imports within core
- Use `crypto.getRandomValues()`, never `Math.random()`
- Icons via unplugin-icons (`<icon-lucide-*>`)

## Test fixtures

`.fig` fixtures in `tests/fixtures/` are Git LFS. Use `git push --no-verify` to skip the slow LFS pre-push hook unless you changed `.fig` files.

## Commits

Follow the existing style in `git log`. Keep messages concise. Update `CHANGELOG.md` for user-facing changes.
