# vitepress-docs Specification (delta)

## New Requirements

### Requirement: AGENTS.md reference in contributing docs
The contributing documentation SHALL mention AGENTS.md as the AI agent coding conventions reference. Developers and agents working on the codebase should read AGENTS.md for rendering, scene graph, component, layout, UI, and file format conventions.

### Requirement: CLI & Headless Mode in roadmap
The roadmap SHALL include CLI & Headless Mode as a planned feature under Phase 5 (AI Integration): attached mode (WebSocket to running editor for eval, create, export, screenshot) and headless mode (engine in Bun/Node for lint, analysis, validation in CI). Package extraction: core/ (engine without rendering), cli/, mcp/.
