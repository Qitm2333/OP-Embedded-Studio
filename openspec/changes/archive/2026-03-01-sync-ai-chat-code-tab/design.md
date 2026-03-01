# Design: Sync AI chat, Code tab

## Approach
Documentation-only. Update/create specs for AI chat and Code panel, propagate to VitePress docs and comparison matrix.

## Affected spec domains

1. **editor-ui** — Properties panel restructured to Design | Code | AI tabs, DesignPanel extraction, ChatPanel + sub-components, CodePanel, ⌘J shortcut
2. **scene-graph** (new requirement) — sceneNodeToJsx() export function
3. **testing** — Playwright chat tests with mock transport, 14 JSX export tests

## New spec domain consideration
AI chat could warrant its own spec domain, but it's tightly integrated into editor-ui (tab in properties panel, tools call editor store). Keep in editor-ui for now.

## VitePress docs updates
- features.md: add "AI Chat" section, add "Code Panel" section, update Properties Panel description
- figma-comparison.md: AI tools 🔲→🟡, Code snippets 🔲→🟡, Dev Mode 🔲→🟡
- roadmap.md: Phase 5 delivered items (AI chat, Code tab)
- keyboard-shortcuts.md: ⌘J (toggle AI chat)
