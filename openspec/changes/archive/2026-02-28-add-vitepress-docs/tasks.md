## 1. Setup VitePress

- [x] 1.1 Install vitepress as devDependency: `bun add -D vitepress`
- [x] 1.2 Add `docs:dev`, `docs:build`, `docs:preview` scripts to package.json
- [x] 1.3 Add `docs/.vitepress/dist` and `docs/.vitepress/cache` to .gitignore
- [x] 1.4 Create `docs/.vitepress/config.ts` with: site title/description, dark appearance, sidebar (Guide/Reference/Development groups), top nav, local search, cleanUrls, socialLinks (GitHub), editLink, lastUpdated
- [x] 1.5 Create `docs/public/` with favicon (or reuse existing logo if available)

## 2. Create documentation pages — Guide

- [x] 2.1 Create `docs/index.md` — VitePress home layout with hero (title, tagline, action buttons) and features grid
- [x] 2.2 Create `docs/guide/getting-started.md` — installation, dev server, desktop app setup per platform (from README)
- [x] 2.3 Create `docs/guide/features.md` — feature overview with descriptions (from README + PLAN.md tools section)
- [x] 2.4 Create `docs/guide/architecture.md` — system architecture as Mermaid diagram + component descriptions (from PLAN.md)
- [x] 2.5 Create `docs/guide/tech-stack.md` — technology choices and rationale table (from PLAN.md + README)

## 3. Create documentation pages — Reference

- [x] 3.1 Create `docs/reference/keyboard-shortcuts.md` — full shortcut tables with implementation status (from PLAN.md)
- [x] 3.2 Create `docs/reference/node-types.md` — 29 node types table + core properties (from PLAN.md Scene Graph)
- [x] 3.3 Create `docs/reference/mcp-tools.md` — 118 MCP tools in collapsible category groups (from PLAN.md AI section)
- [x] 3.4 Create `docs/reference/scene-graph.md` — scene graph internals: storage, undo/redo, layout engine (from PLAN.md)
- [x] 3.5 Create `docs/reference/file-format.md` — .fig import pipeline, .openpencil format, Kiwi codec (from PLAN.md)

## 4. Create documentation pages — Development

- [x] 4.1 Create `docs/development/contributing.md` — project structure, code style, tooling (oxlint/oxfmt/tsgo)
- [x] 4.2 Create `docs/development/testing.md` — E2E (Playwright), unit (bun:test), Figma CDP reference tests
- [x] 4.3 Create `docs/development/openspec.md` — spec-driven workflow: propose → apply → archive
- [x] 4.4 Create `docs/development/roadmap.md` — 6 phases from PLAN.md with current progress indicators

## 5. Verify

- [x] 5.1 Run `bun run docs:dev` and confirm the site loads with all pages and sidebar navigation
- [x] 5.2 Run `bun run docs:build` and confirm it produces output without errors
