---
title: AI Chat
description: Embedded-first AI assistant with reference images and visual design verification.
---

# AI Chat

Press <kbd>⌘</kbd><kbd>J</kbd> (<kbd>Ctrl</kbd> + <kbd>J</kbd>) to open the AI assistant. Describe what you want, paste or attach reference images, and let the assistant create or refine the selected screen Frame.

The chat is tuned for embedded displays. It receives the active device profile, logical resolution, visible-area shape, and selected Frame. For round screens, it keeps critical text and controls away from clipped corners and favors readable type, high contrast, low density, and touch targets sized for a physical device.

## Setup

1. Open the AI chat panel (<kbd>⌘</kbd><kbd>J</kbd>)
2. Click the settings icon
3. Choose a provider and enter your API key
4. Select a model

### Supported Providers

| Provider                 | Models                                          | Setup                                                                                                       |
| ------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **OpenRouter**           | Claude, GPT, Gemini, DeepSeek, Qwen, and others | API key from [openrouter.ai](https://openrouter.ai)                                                         |
| **Anthropic**            | Claude Sonnet 4.6, Claude Opus 4.6              | API key from [console.anthropic.com](https://console.anthropic.com)                                         |
| **OpenAI**               | GPT-5.3 Codex, GPT-4.1, o3, o4-mini             | API key from [platform.openai.com](https://platform.openai.com)                                             |
| **Google AI**            | Gemini 3.1 Pro, Gemini 3 Flash                  | API key from [aistudio.google.dev](https://aistudio.google.dev)                                             |
| **Z.ai**                 | GLM-5.1, GLM-5, GLM-4.7, GLM-4.5 family         | API key from [docs.z.ai](https://docs.z.ai/devpack/quick-start)                                             |
| **MiniMax**              | MiniMax M2.7, M2.7-highspeed, M2.5, M2.1        | API key from [platform.minimax.io](https://platform.minimax.io/user-center/basic-information/interface-key) |
| **OpenAI-compatible**    | Any endpoint with OpenAI API format             | Custom base URL + key. Supports Completions and Responses API toggle.                                       |
| **Anthropic-compatible** | Any endpoint with Anthropic API format          | Custom base URL + key                                                                                       |

No backend, no subscription — your key talks directly to the provider.

## Reference Images

Paste an image from the clipboard, drop images onto the composer, or use the attachment button. The composer previews PNG, JPEG, and WebP images before sending and supports up to four references in one message. Large source images are resized before they enter the conversation.

Reference images are visual context rather than an asset library. The assistant inspects their composition, hierarchy, palette roles, typography, component shapes, and distinctive details before writing the complete screen code. Later screenshot reviews compare the render against those pixels instead of relying on a generic claim that the style matches.

Image input depends on the selected model. ACP agents negotiate this capability when the session starts and return an actionable error if the agent does not support images.

## What It Can Do

Direct Design chat is code-only. On every user turn, the host serializes the currently selected Frame into canonical Design JSX. The model receives only the existing core `render` action and submits one complete replacement root with the selected Frame ID as `replace_id`. The host compiles the replacement, recomputes layout, records undo, and selects the new Frame for the next turn.

Historical render calls and their complete JSX payloads are removed from later model requests because the current canvas JSX supersedes them. Earlier reference-image bytes are also omitted while ordinary requests and assistant summaries remain. This keeps continuous conversations bounded without losing the current design state.

The MCP server and ACP agents still expose the complete tool registry for external coding agents and automation clients. Those integrations cover these categories:

- **Create** — frames, shapes, text, components, pages. Renders JSX for complex layouts.
- **Style** — fills, strokes, effects, opacity, corner radius, blend modes.
- **Layout** — auto-layout, grid, alignment, spacing, sizing.
- **Components** — create components, instances, component sets. Manage overrides.
- **Variables** — create/edit variables, collections, modes. Bind to fills.
- **Query** — find nodes, XPath selectors, read properties, list pages, fonts, selection.
- **Inspect** — `get_jsx` for JSX roundtrip view, `diff_jsx` for structural diffs, `describe` for semantic role and design issue detection.
- **Analyze** — color palette, typography audit, spacing consistency, cluster detection.
- **Export** — PNG, SVG, JSX with Tailwind classes. Vision-based verification via `export_image`.
- **Vector** — boolean operations, path manipulation.

## Reference-Guided Design

Vision-capable models inspect images attached to the current user request and translate their composition, hierarchy, palette, typography, shapes, and distinctive details into Design JSX. The host no longer runs an automatic screenshot-and-repair loop after every render; visual verification remains available through the normal editor preview and external ACP/MCP tooling when explicitly requested.

The direct agent makes exactly one bounded model call and stops as soon as `render` succeeds or fails. It does not make a second model request for repair or summary, so a tool error cannot leave the composer waiting on another provider response. The result is shown as one compact status row without exposing raw JSX.

ACP agents can still inspect the canvas through the connected MCP server according to the agent's own tool and image capabilities.

## Example Prompts

- "Create a card with a title, description, and a blue button"
- "Make all buttons on this page use the same border radius"
- "What fonts are used in this file?"
- "Change the background of the selected frame to a gradient from blue to purple"
- "Export the selected frame as SVG"
- "Find all text nodes with font size less than 12"
- "Describe the selected component — what role does it look like?"
- "Show me the JSX for this frame"

## Tips

- Select nodes before asking — the assistant knows what's selected.
- Attach screenshots when the visual direction matters more than exact written specifications.
- Be specific about colors, sizes, and positions for precise results.
- The assistant revises the selected screen as one complete code artifact rather than a sequence of node edits.
- Use "undo" in the editor if you don't like the result — AI mutations support full undo.
- Review the rendered canvas before deployment; Design chat deliberately avoids automatic repair loops.
