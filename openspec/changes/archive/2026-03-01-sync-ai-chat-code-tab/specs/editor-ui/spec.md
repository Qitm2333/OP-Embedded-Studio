# editor-ui Specification (delta)

## Modified Requirements

### Requirement: Properties panel with sections (MODIFIED)
The properties panel SHALL be organized as a tabbed interface with Design | Code | AI tabs (reka-ui Tabs). The Design tab contains the existing property sections (DesignPanel). The Code tab shows JSX export. The AI tab shows the chat interface.

#### Scenario: Switch to Code tab
- **WHEN** user clicks the Code tab in the properties panel
- **THEN** the JSX code representation of the selection is displayed

#### Scenario: Switch to AI tab
- **WHEN** user clicks the AI tab
- **THEN** the AI chat interface is displayed

## New Requirements

### Requirement: AI chat panel
The editor SHALL include an AI chat panel accessible via the AI tab in properties panel or ⌘J shortcut. The panel provides: message list with streaming markdown (vue-stream-markdown), tool call timeline with collapsible details (reka-ui Collapsible), typing indicator, API key setup for OpenRouter (stored in Tauri Stronghold). Messages scroll automatically (reka-ui ScrollArea).

#### Scenario: Send message
- **WHEN** user types a message and presses Enter in the chat input
- **THEN** the message is sent to OpenRouter and a streaming response appears

#### Scenario: Toggle chat
- **WHEN** user presses ⌘J
- **THEN** the properties panel switches to the AI tab (or back to Design)

### Requirement: AI model selector
The chat input SHALL include a model selector with curated models: Claude, Gemini, GPT, DeepSeek, Qwen, Kimi, Llama. Models are stored in @open-pencil/core constants with benchmark-ranked tags.

#### Scenario: Change model
- **WHEN** user selects a different model from the selector
- **THEN** subsequent messages use the selected model

### Requirement: AI tools
The chat SHALL support 10 design tools with valibot schemas: create_shape, set_fill, set_stroke, update_node, set_layout, delete_node, select_nodes, get_page_tree, get_selection, rename_node. Tools execute against the editor store. The ToolLoopAgent calls tools automatically in a loop.

#### Scenario: AI creates a shape
- **WHEN** user asks "Create a blue rectangle 200×100"
- **THEN** the AI calls create_shape with type RECTANGLE, width 200, height 100, and set_fill with blue color

#### Scenario: Tool call visible in chat
- **WHEN** the AI executes a tool
- **THEN** a collapsible tool call section shows the tool name, input, and output

### Requirement: DirectChatTransport
The chat SHALL communicate directly with OpenRouter from the browser — no backend server required. The API key is stored securely in Tauri Stronghold (or localStorage fallback in browser). X-OpenRouter-Title header identifies the app.

#### Scenario: No backend required
- **WHEN** user configures an OpenRouter API key and sends a message
- **THEN** the request goes directly to OpenRouter without a proxy server

### Requirement: Code panel with JSX export
The properties panel Code tab SHALL display the selected node(s) as JSX code using sceneNodeToJsx(). The panel provides Prism.js syntax highlighting, line numbers, and a copy-to-clipboard button. Multi-selection shows each node's JSX.

#### Scenario: View JSX for selection
- **WHEN** user selects a frame and clicks the Code tab
- **THEN** the JSX representation of the frame and its children is displayed with syntax highlighting

#### Scenario: Copy JSX
- **WHEN** user clicks the copy button in the Code panel
- **THEN** the JSX code is copied to the clipboard
