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
bun run test:unit    # bun:test (tests/engine/)
bun run test         # Playwright E2E (auto-starts dev server)
```

## Project structure

- `packages/core` — scene graph, renderer, layout, codec (zero DOM deps)
- `packages/cli` — headless CLI for .fig inspection and export
- `packages/mcp` — MCP server for AI tools (stdio + HTTP)
- `packages/acp` — ACP (Agent Client Protocol) server
- `packages/docs` — VitePress documentation site (openpencil.dev)
- `src/` — Tauri/Vite desktop editor

## Conventions

See [`AGENTS.md`](./AGENTS.md) for the full architecture reference, code conventions, and quality checklist. Key points:

- Bun runtime, not Node
- Tailwind 4 for styles, no inline CSS or `<style>` blocks
- No `any`, no `!` non-null assertions
- `@/` import alias for app code, relative imports within core
- Use `crypto.getRandomValues()`, never `Math.random()`
- Icons via unplugin-icons (`<icon-lucide-*>`)
- Use existing deps and Reka UI components before hand-rolling (see AGENTS.md → Code quality)

## Test fixtures

`.fig` fixtures in `tests/fixtures/` are Git LFS. Use `git push --no-verify` to skip the slow LFS pre-push hook unless you changed `.fig` files.

## Commits

Follow the existing style in `git log`. Keep messages concise. Update `CHANGELOG.md` for user-facing changes.
