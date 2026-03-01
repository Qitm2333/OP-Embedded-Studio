## Why

The existing VitePress docs site (`docs/`) is developer-focused — architecture, reference, contributing. There's no user-facing documentation that explains how to actually use the editor. New users have no guide for canvas navigation, drawing shapes, using auto-layout, working with components, editing text, etc. A "User Guide" section derived from the OpenSpec specifications would provide task-oriented documentation covering all implemented features.

## What Changes

- Add a new `User Guide` sidebar group in VitePress with articles covering each user-facing feature area
- Generate articles from OpenSpec specs: canvas navigation, selection & manipulation, drawing & shapes, auto-layout, components & instances, text editing, pen tool, layers & pages, context menu, export, keyboard shortcuts summary
- Add a user guide landing page with feature overview and navigation
- Update VitePress config sidebar/nav to include the new section
- Keep existing Guide/Reference/Development sections unchanged

## Capabilities

### New Capabilities
- `userdoc-articles`: VitePress user documentation pages generated from OpenSpec specs — canvas navigation, selection, shapes, auto-layout, components, text, pen tool, layers, export, and variables

### Modified Capabilities
- `vitepress-docs`: Adding a new "User Guide" sidebar group and nav entry to the existing VitePress config

## Impact

- `docs/` — new `.md` files under `docs/user-guide/`
- `docs/.vitepress/config.ts` — sidebar and nav updates
- No runtime code changes, no dependency changes
