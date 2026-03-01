# Tasks: Sync AGENTS.md, CLI Plan, Identifier Fix

Reference: 8 commits from master (70c88dd..7ff16f7).

## 1. Update OpenSpec Specs

- [x] 1.1 Update `openspec/specs/desktop-app/spec.md` — update app identifier to `net.dannote.open-pencil`.

## 2. Update VitePress Docs

- [x] 2.1 Update `docs/development/contributing.md` — add AGENTS.md reference for AI agent conventions.
- [x] 2.2 Update `docs/development/roadmap.md` — add CLI & Headless Mode to Phase 5 Planned (attached + headless modes, core/ extraction, CLI commands).
- [x] 2.3 Update `docs/guide/features.md` — add offline/lightweight messaging to Desktop App section to align with README.
- [x] 2.4 Update `docs/guide/figma-comparison.md` — update "Keyboard shortcuts" notes to reflect fixed Mac modifier shortcuts. Add AGENTS.md/CLI note under "MCP server" row.

## 3. Verify

- [x] 3.1 Run `bun run docs:build` to verify VitePress build passes.
