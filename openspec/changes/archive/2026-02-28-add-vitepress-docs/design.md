## Context

The project uses Vite 7, Vue 3, and TypeScript. VitePress (Vue's official static site generator) fits naturally — it shares the Vite build pipeline and Vue component ecosystem. The existing documentation is:
- `PLAN.md` — 1565-line comprehensive design doc with architecture, tools, phases, keyboard shortcuts, technical deep dives
- `README.md` — project overview, features, tech stack, getting started, project structure
- `openspec/specs/` — 19 capability specs with requirements and scenarios

The editor app runs on port 1420. VitePress should use a different port for its dev server.

## Goals / Non-Goals

**Goals:**
- Browsable documentation site generated from Markdown
- Content restructured from existing PLAN.md, README, and openspec specs
- Sidebar navigation with logical grouping
- Dark theme matching editor aesthetic
- `docs:dev` / `docs:build` / `docs:preview` scripts

**Non-Goals:**
- Custom VitePress theme (use default theme)
- API documentation auto-generation from source code
- Deployment configuration (CI/CD, hosting)
- i18n / localization
- Search integration beyond VitePress built-in

## Decisions

### 1. VitePress in `docs/` directory (separate from app)

VitePress runs as an independent project in `docs/` with its own `.vitepress/config.ts`. It does NOT share the app's `vite.config.ts` — they are completely separate build pipelines.

**Why:** VitePress has its own Vite instance. Mixing with the app config would cause conflicts (different plugins, different entry points). Standard convention across all major VitePress projects.

### 2. Content structure: guide / reference / development

```
docs/
  index.md                    — landing page (from README)
  guide/
    getting-started.md        — installation, dev server, desktop app
    features.md               — feature overview with screenshots
    architecture.md           — system architecture diagram and explanation
    tech-stack.md             — tech choices and rationale
  reference/
    keyboard-shortcuts.md     — full shortcut table from PLAN.md
    node-types.md             — 29 node types with properties
    mcp-tools.md              — 118 MCP tools reference
    scene-graph.md            — scene graph technical details
    file-format.md            — .fig/.openpencil format details
  development/
    contributing.md           — how to contribute
    testing.md                — test setup and running
    openspec.md               — spec-driven development workflow
    roadmap.md                — phases and current progress
```

**Why:** Three-tier structure (guide → reference → development) is the standard pattern used by Vue, Vite, Pinia, and Nuxt documentation. Users discover via guides, look up via reference, and contribute via development docs.

### 3. VitePress as devDependency only

VitePress is added as a devDependency — it's a development tool, not shipped with the editor.

### 4. Port 5173 for docs dev server

VitePress defaults to 5173. The editor uses 1420. No conflict.

## Risks / Trade-offs

- **Content staleness** → Mitigation: docs pages are Markdown in-repo, reviewed alongside code changes. Openspec specs are the source of truth for capabilities.
- **Maintenance burden** → Mitigation: minimal custom configuration. Default VitePress theme. Content is restructured from existing artifacts, not written from scratch.
