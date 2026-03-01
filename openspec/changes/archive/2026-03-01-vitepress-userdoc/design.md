## Context

The project has a VitePress docs site at `docs/` with three sections: Guide (getting started, features, architecture, tech stack, comparison), Reference (shortcuts, node types, MCP tools, scene graph, file format), and Development (contributing, testing, openspec, roadmap). All content is developer/contributor-oriented.

OpenSpec `openspec/specs/` contains 24 feature specs with detailed requirements and scenarios covering every user-facing feature. These specs are the authoritative source of truth for what the editor can do.

## Goals / Non-Goals

**Goals:**
- Add a "User Guide" section to VitePress with task-oriented articles derived from OpenSpec specs
- Cover all user-facing features: canvas navigation, selection, drawing, auto-layout, components, text, pen tool, layers/pages, context menu, export, variables
- Each article explains how to use the feature with keyboard shortcuts, step-by-step instructions, and tips
- Articles follow consistent structure: intro, how-to steps, shortcuts table, tips

**Non-Goals:**
- Automated spec-to-docs pipeline (manual generation this time, automation later)
- Screenshots or video content (text-only for now)
- API/developer documentation (already covered in existing sections)
- Translating docs to other languages

## Decisions

**Article structure**: Each article follows a consistent template: brief intro → feature walkthrough with subsections → keyboard shortcuts table → tips/notes. This mirrors how Figma's help center organizes content and is familiar to design tool users.

**File organization**: All user guide articles live under `docs/user-guide/` with an `index.md` landing page. Naming matches the feature area (e.g., `canvas-navigation.md`, `auto-layout.md`).

**Sidebar placement**: The "User Guide" group goes first in the sidebar, before the existing Guide section. User docs are the primary audience; developer docs are secondary.

**Content derivation**: Each article is written by reading the corresponding OpenSpec spec(s) and translating requirements/scenarios into user-friendly how-to content. The spec's Purpose and Scenarios provide the skeleton; the article adds context, flow, and readability.

**Article list** (12 articles):
1. `index.md` — overview with links to all articles
2. `canvas-navigation.md` — from `canvas-navigation` spec
3. `selection-and-manipulation.md` — from `selection-manipulation` spec
4. `drawing-shapes.md` — from `editor-ui` spec (toolbar, shape tools) + `canvas-rendering` spec
5. `auto-layout.md` — from `auto-layout` spec
6. `components.md` — from `components` spec
7. `text-editing.md` — from `text-editing` spec
8. `pen-tool.md` — from `pen-tool` spec
9. `layers-and-pages.md` — from `editor-ui` spec (layers panel, pages panel)
10. `context-menu.md` — from `context-menu` spec
11. `exporting.md` — from `editor-ui` spec (export section) + `fig-import` spec
12. `variables.md` — from `editor-ui` spec (variables dialog, fill variable picker)

## Risks / Trade-offs

- [Content drift] Specs evolve but docs may lag → Mitigate by documenting the spec-to-doc mapping so future changes can update both
- [No screenshots] Text-only docs are less engaging → Acceptable for v1; screenshots can be added later
- [Mac-centric shortcuts] Shortcuts use ⌘ notation → Add a note about Ctrl equivalents on Linux/Windows
