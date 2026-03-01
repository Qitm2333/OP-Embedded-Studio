# AI Chat — Design Document

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Browser (Vue app)                                       │
│                                                         │
│  ChatPanel.vue ─── useChat() ──→ /api/chat (streaming)  │
│       │                              │                  │
│       │ tool results render          │                  │
│       │ in chat as timeline          ▼                  │
│       │                     Vite dev server proxy        │
│       │                              │                  │
└───────│──────────────────────────────│──────────────────┘
        │                              │
        │ tool executions              │
        │ mutate store directly        ▼
        │ (same JS context)    ┌──────────────────┐
        │                      │ Backend (Bun)     │
        │                      │                   │
        │                      │ AI SDK ToolLoop   │
        │                      │ OpenRouter        │
        │                      │ Claude Sonnet     │
        │                      └──────────────────┘
```

Key insight: tools execute **in the browser**, not on the server. The LLM runs server-side (OpenRouter), but when it calls a tool like `create_frame`, the tool execution happens in the Vue app where the editor store lives. This is the inverse of beebro-chat where tools run server-side.

**Flow:**
1. User types in chat panel → message sent to backend
2. Backend streams LLM response via AI SDK `ToolLoopAgent`
3. When LLM calls a tool → tool call streamed to client
4. Client intercepts tool call → executes against `editorStore` → returns result
5. Result sent back to server → LLM continues
6. Text/tool results render in chat

This is the AI SDK's **client-side tool execution** pattern.

## UI Layout

Chat panel replaces the right sidebar (properties panel) when active, toggled with a keyboard shortcut or button. Properties and chat never need to be visible simultaneously — when you're chatting with AI, you're describing intent, not tweaking pixel values.

```
┌──────────┬────────────────────────┬──────────┐
│  Layers  │       Canvas           │   Chat   │
│          │                        │  Panel   │
│          │                        │          │
│          │   ┌──────────┐         │ messages │
│          │   │ selected │         │ + tools  │
│          │   │  frame   │         │          │
│          │   └──────────┘         │          │
│          │                        │──────────│
│          │                        │ [input]  │
└──────────┴────────────────────────┴──────────┘
```

Toggle: `⌘J` (matches VS Code/Cursor convention) or click AI icon in toolbar.

The `SplitterPanel` on the right switches between `<PropertiesPanel>` and `<ChatPanel>` based on state. Both share the same splitter slot — no extra panel.

## Comments as Context

Users can pin comments on the canvas (like Figma's comment mode). These are NOT the collaboration "comments" feature from Phase 6 — they're **AI context annotations**.

When the user sends a chat message, any comments visible in the current viewport (or on selected nodes) are automatically included as context:

```
System prompt includes:
- Current page structure (node tree summary)  
- Selected nodes with properties
- Visible comments with their positions and attached node IDs

User says: "make the spacing consistent"
→ LLM sees the comments like:
  Comment on Frame "Header": "This should be 16px gap"
  Comment on Frame "Cards": "Use 8px grid"
→ LLM calls set_layout tools with correct spacing
```

Comments are stored on the `SceneNode` (new field: `comments: CommentPin[]`) and saved with the .fig/.openpencil file. They persist across sessions.

## Tool Categories

### Read tools (context gathering)
| Tool | Description |
|------|-------------|
| `get_page_tree` | Current page node tree (truncated) |
| `get_node` | Node properties by ID |
| `get_selection` | Currently selected nodes |
| `get_children` | Children of a node |
| `find_nodes` | Search by name/type |
| `get_comments` | All comment pins |
| `screenshot` | Render current viewport to image |

### Create tools
| Tool | Description |
|------|-------------|
| `create_frame` | Frame with optional auto-layout |
| `create_rectangle` | Rectangle |
| `create_ellipse` | Ellipse |
| `create_text` | Text node |
| `create_line` | Line |
| `create_star` | Star |
| `create_polygon` | Polygon |
| `create_instance` | Component instance |
| `create_component` | Convert to component |

### Modify tools
| Tool | Description |
|------|-------------|
| `set_fill` | Set fill color |
| `set_stroke` | Set stroke |
| `set_effect` | Shadow, blur |
| `set_text` | Change text content |
| `set_font` | Font family, size, weight |
| `set_layout` | Auto-layout mode, gap, padding, alignment |
| `set_radius` | Corner radius |
| `set_opacity` | Opacity |
| `set_size` | Width, height |
| `move_node` | Position |
| `rename_node` | Name |
| `set_constraints` | Resize constraints |
| `reparent_node` | Move to different parent |

### Organize tools
| Tool | Description |
|------|-------------|
| `delete_nodes` | Delete by IDs |
| `group_nodes` | Group selection |
| `ungroup_nodes` | Ungroup |
| `bring_to_front` | Z-order |
| `send_to_back` | Z-order |
| `select_nodes` | Set selection |
| `add_comment` | Pin a comment to canvas/node |

### Variable tools
| Tool | Description |
|------|-------------|
| `list_variables` | List variables |
| `create_variable` | Create variable |
| `bind_variable` | Bind to node property |

## Tool Call Display

Tool calls render inline in the chat as a collapsible timeline (like beebro-chat's `ToolTimeline`):

```
User: Create a card component with title, image, and description

AI: I'll create that card component for you.

  ✓ create_frame "Card" 320×400
  ✓ create_rectangle "Image" 320×200
  ✓ create_text "Title" — "Card Title"
  ✓ create_text "Description" — "Lorem ipsum..."
  ✓ set_layout vertical, gap=16, padding=16
  ✓ create_component → component 0:42

Done! I created a Card component with auto-layout.
The image placeholder is 320×200 at the top,
followed by the title and description with 16px spacing.
```

Each tool call shows:
- **Icon** — shape icon for creates, paint icon for fills, layout icon for layout, etc.
- **Label** — human-readable: "Create frame" not "create_frame"
- **Summary** — key params: name, dimensions, color value
- **State** — spinner while executing, ✓ when done, ✗ on error
- **Expandable** — click to see full params and result JSON

For `screenshot` tool calls, the captured image renders inline in the chat as a thumbnail.

## Stack

### Backend (new `packages/ai/`)
```
ai@6.0.0-beta          — ToolLoopAgent, streaming, tool definitions
@ai-sdk/valibot        — schema validation
@openrouter/ai-sdk-provider — model provider
valibot                — tool param schemas
```

Runs as a separate Bun process in dev (Vite proxies `/api/*`), or as a Tauri sidecar in production.

### Frontend (in app)
```
ai/vue                 — useChat() composable for Vue
```

The `useChat()` composable from AI SDK handles:
- Message state management
- SSE streaming
- Tool call/result roundtrip
- Abort/cancel

## Tool Definition Pattern

```typescript
// packages/ai/src/tools/create-frame.ts
import { tool } from 'ai'
import * as v from 'valibot'

export const createFrame = tool({
  description: 'Create a frame (container) with optional auto-layout',
  parameters: v.object({
    x: v.number(),
    y: v.number(),
    width: v.number(),
    height: v.number(),
    name: v.optional(v.string()),
    parent: v.optional(v.string(), 'Parent node ID'),
    fill: v.optional(v.string(), 'Hex color'),
    layout: v.optional(v.picklist(['HORIZONTAL', 'VERTICAL', 'NONE'])),
    gap: v.optional(v.number()),
    padding: v.optional(v.number())
  })
  // execute is provided client-side, not here
})
```

The tool `execute` functions live in the Vue app (not the server) because they need access to the editor store:

```typescript
// src/composables/use-ai-tools.ts
export function useAITools(store: EditorStore) {
  return {
    create_frame: {
      ...createFrameDef,
      execute({ x, y, width, height, name, parent, fill, layout, gap, padding }) {
        const parentId = parent ?? store.state.currentPageId
        const node = store.createShape('FRAME', parentId, { x, y, width, height })
        if (name) store.renameNode(node.id, name)
        if (fill) store.updateNode(node.id, { fills: [parseFill(fill)] })
        if (layout) store.setLayoutMode(node.id, layout)
        // ... gap, padding
        return { id: node.id, name: node.name }
      }
    }
  }
}
```

## System Prompt

```
You are an AI design assistant inside OpenPencil, a design editor.
You can create and modify design elements on the canvas.

Current page: {pageName}
Selected nodes: {selectedNodesSummary}
Comments: {visibleComments}

Guidelines:
- Use auto-layout (set_layout) for any container with multiple children
- Use 8px grid for spacing (8, 16, 24, 32, 48)
- Name nodes descriptively (not "Frame 1")
- After creating a complex layout, use screenshot to verify it looks correct
- Read the existing design before making changes (get_page_tree)
```

## Comment Pin Data Model

```typescript
interface CommentPin {
  id: string
  text: string
  x: number           // canvas coordinates
  y: number
  nodeId?: string      // attached to a specific node
  resolved: boolean
  createdAt: number
}
```

Stored on `SceneGraph` (not individual nodes) since comments can be pinned to empty canvas areas:

```typescript
// In SceneGraph
comments = new Map<string, CommentPin>()
```

## Implementation Order

1. **Backend skeleton** — `packages/ai/` with Bun server, single `/api/chat` streaming endpoint, ToolLoopAgent with 2-3 tools
2. **Chat panel UI** — `ChatPanel.vue` with message list, input, tool timeline, toggle via `⌘J`
3. **Core tools** — create_frame, create_text, create_rectangle, set_fill, set_layout, get_page_tree, get_selection
4. **Screenshot tool** — render viewport to PNG, inline in chat
5. **Comment system** — comment pins on canvas, included in AI context
6. **Full tool set** — port remaining tools from figma-use's MCP definitions
7. **Tauri integration** — bundle AI backend as sidecar
