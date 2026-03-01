## Why

OpenPencil has extensive knowledge spread across PLAN.md (1565 lines), README.md, and 19 openspec specs — but no browsable documentation site. Contributors and users have to read raw Markdown in the repo. PLAN.md Phase 6 lists "documentation" as a deliverable. VitePress is a natural fit: same Vite ecosystem, Vue-native, generates static sites from Markdown, zero config out of the box.

## What Changes

- Add VitePress as dev dependency
- Create `docs/` directory with documentation site structure
- Content sourced from existing artifacts: PLAN.md sections, README.md, openspec specs
- Add `docs:dev` and `docs:build` scripts to package.json
- VitePress config with sidebar navigation, dark theme matching the editor

## Capabilities

### New Capabilities

- `vitepress-docs`: VitePress documentation site at `docs/` with content derived from PLAN.md, README, and openspec specs. Includes guide pages (getting started, architecture, tech stack), reference pages (keyboard shortcuts, node types, MCP tools), and development pages (contributing, testing, openspec workflow).

### Modified Capabilities

- `tooling`: Adding VitePress dependency and docs scripts to the build toolchain

## Impact

- `docs/` — new directory with VitePress config and Markdown pages
- `docs/.vitepress/config.ts` — VitePress configuration
- `package.json` — new `docs:dev`, `docs:build`, `docs:preview` scripts + vitepress devDependency
- `.gitignore` — add `docs/.vitepress/dist` and `docs/.vitepress/cache`
- No changes to the editor application itself
