# Tasks: Sync AI chat, Code tab

Reference: 19 commits from master (6268d8b..c59d5fc).
Delta-specs in `openspec/changes/sync-ai-chat-code-tab/specs/` (editor-ui, scene-graph, testing).
Proposal: `proposal.md`, Design: `design.md` — validated and aligned with delta-specs.

Section 1 (specs) MUST complete before Section 2 (docs) — docs reference merged spec content.

## 1. Merge Delta-Specs into Main Specs

Each task merges ADDED and MODIFIED requirements from the delta-spec into the baseline at `openspec/specs/<domain>/spec.md`. Untouched baseline requirements are preserved. No conflicts between domains.

- [x] 1.1 Update `openspec/specs/editor-ui/spec.md` — MODIFIED: "Properties panel" → Design | Code | AI tabs. ADDED: "AI chat panel" (message list, streaming markdown, tool timeline, API key, ⌘J), "AI model selector" (curated models in core constants), "AI tools" (10 tools with valibot, ToolLoopAgent), "DirectChatTransport" (no backend, OpenRouter, Stronghold), "Code panel with JSX export" (Prism.js, line numbers, copy)
- [x] 1.2 Update `openspec/specs/scene-graph/spec.md` — ADDED: "Scene node to JSX export" (sceneNodeToJsx function)
- [x] 1.3 Update `openspec/specs/testing/spec.md` — ADDED: "AI chat Playwright tests" (mock transport, tool call e2e), "JSX export tests" (14 tests)

## 2. Update VitePress Docs

All target files already exist — no sidebar/nav changes needed.

- [x] 2.1 Update `docs/guide/features.md`:
  - **Modify "Properties Panel" bullet list**: add Code and AI tabs to description
  - **Add "AI Chat" section** (after "Code Quality"): ⌘J toggle, OpenRouter direct (no backend), Stronghold key storage, model selector (Claude/Gemini/GPT/DeepSeek/Qwen/Kimi/Llama), 10 AI tools (create_shape, set_fill, etc.), streaming markdown, tool call timeline, Playwright tests with mock transport
  - **Add "Code Panel" section** (after "AI Chat"): sceneNodeToJsx() in core, Prism.js highlighting, line numbers, copy button, Design | Code | AI tabs
- [x] 2.2 Update `docs/guide/figma-comparison.md` — specific row changes:
  - "AI tools" 🔲→🟡: "10 AI tools via OpenRouter (create/modify/delete shapes, set fills/strokes, layout); no AI-generated content or AI search yet"
  - "Code snippets" 🔲→🟡: "JSX export from selection with syntax highlighting and copy; no CSS/Swift/Kotlin snippets"
  - "Dev Mode (inspect)" 🔲→🟡: "Code tab shows JSX representation; no CSS properties or handoff specs"
  - No other rows change status. After: 64✅, 19🟡, 67🔲 = 150 total. Update coverage line
- [x] 2.3 Update `docs/development/roadmap.md` — Phase 5 Delivered: add AI chat (OpenRouter, 10 tools, model selector, Stronghold, ⌘J, Playwright tests), Code panel (sceneNodeToJsx, Prism.js, 14 tests)
- [x] 2.4 Update `docs/reference/keyboard-shortcuts.md` — add ⌘J (Toggle AI chat) with ✅ status

## 3. Verify

- [x] 3.1 Run `bun run docs:build` — verify build passes. Confirm: coverage count matches actual ✅/🟡/🔲 tallies via grep -c, no broken anchor warnings
