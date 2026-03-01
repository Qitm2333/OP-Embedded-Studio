# Proposal: Sync AGENTS.md, CLI Plan, Identifier Fix

## Why

8 commits merged from master (70c88dd..7ff16f7) add AI agent conventions (AGENTS.md), CLI & Headless Mode plan in PLAN.md, README updates (screenshot, feature list, offline messaging), and a Tauri app identifier fix.

## What Changes

### Implemented
1. **App identifier fix** — changed from `com.dannote.open-pencil-app` to `net.dannote.open-pencil` in tauri.conf.json
2. **AGENTS.md** — coding conventions file for AI agents (commands, code style, rendering, scene graph, components, layout, UI, file format, Tauri conventions, figma-use reference, known issues)
3. **README updates** — added screenshot, components & instances in feature list, system fonts, gradients, ~5 MB offline messaging

### Planned (in PLAN.md, not yet implemented)
4. **CLI & Headless Mode** — attached mode (WebSocket to running editor) and headless mode (engine in Bun/Node without GUI). Package structure: core/, cli/, mcp/. Commands: eval, find, lint, export, node get/tree, create, set, analyze, screenshot.
5. **Yoga CSS Grid tracking** — upstream PR details (facebook/yoga#1893–#1902)
