# Proposal: Sync AI chat, Code tab

## Why
19 commits from master (6268d8b..c59d5fc) introduce AI chat integration and a Code panel for JSX export.

## What changed

### AI chat (5d23c3e → bf8636c, 15 commits)
- ChatPanel with message list, tool timeline, typing indicator, API key setup via Tauri Stronghold
- DirectChatTransport: no backend server, calls OpenRouter directly from browser
- ToolLoopAgent with 10 AI tools (valibot schemas): create_shape, set_fill, set_stroke, update_node, set_layout, delete_node, select_nodes, get_page_tree, get_selection, rename_node
- Model selector with curated list: Claude 4.6, Gemini 3.1, GPT-5.3, DeepSeek V3.2, Qwen 3.5, Kimi K2.5, Llama
- ⌘J keyboard shortcut to toggle chat
- Properties panel restructured: Design | Code | AI tabs (reka-ui Tabs)
- DesignPanel extracted from PropertiesPanel
- ChatMessage, ChatInput, APIKeySetup sub-components
- reka-ui ScrollArea/Collapsible/Tooltip, tw-animate-css, vue-stream-markdown for streaming
- Playwright tests with mock transport, tool call e2e test
- X-OpenRouter-Title header for app identification

### Code tab / JSX export (c59d5fc)
- sceneNodeToJsx() in @open-pencil/core: converts SceneNode subtree to JSX using builder syntax
- CodePanel.vue with Prism.js syntax highlighting, line numbers, copy button
- Third tab in properties panel
- 14 new tests covering shapes, text, layout, effects, multi-selection
