# Współpraca

## Struktura projektu

```
packages/
  core/              @open-pencil/core — Engine
  cli/               @open-pencil/cli — Headless CLI
  mcp/               @open-pencil/mcp — MCP server
  docs/              @open-pencil/docs — VitePress
src/
  components/        Vue SFCs
  composables/       Canvas input, shortcuts, rendering
  stores/            Editor state
desktop/             Tauri v2
tests/
  e2e/               Playwright
  engine/            bun:test
openspec/            Specs + changes
```

## Środowisko deweloperskie

```sh
bun install
bun run dev          # Editor: localhost:1420
bun run docs:dev     # Docs: localhost:5173
```

## Styl kodu

### Narzędzia

| Tool | Command | Purpose |
|------|---------|---------|
| oxlint | `bun run lint` | Linting |
| oxfmt | `bun run format` | Formatting |
| tsgo | `bun run typecheck` | Type checking |

```sh
bun run check
```

### Konwencje

- kebab-case (files), PascalCase (components/types), camelCase (functions), SCREAMING_SNAKE_CASE (constants)
- AGENTS.md — [GitHub](https://github.com/open-pencil/open-pencil/blob/master/AGENTS.md)

## Wprowadzanie zmian

1. [OpenSpec](./openspec) specs
2. `openspec new change "name"`
3. `bun run check && bun run test`
4. Pull request

## Kluczowe pliki

| File | Purpose |
|------|---------|
| `packages/core/src/scene-graph.ts` | Scene graph |
| `packages/core/src/renderer.ts` | CanvasKit rendering |
| `packages/core/src/layout.ts` | Yoga layout |
| `packages/core/src/kiwi/codec.ts` | Kiwi codec |
| `packages/cli/src/commands/` | CLI commands |
| `src/stores/editor.ts` | Editor state |
