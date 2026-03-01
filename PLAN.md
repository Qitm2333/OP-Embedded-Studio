# OpenPencil

Open-source, AI-native design editor. Think Figma, but you can self-host it, extend it, and talk to it.

## Why

- Figma is proprietary and expensive
- Penpot is SVG-based (slow for complex documents)
- Pencil.app showed AI-native design is possible, but it's closed source
- None of the existing tools treat AI as a first-class citizen

## Positioning

| | OpenPencil | Figma | Penpot | Pencil.app |
|---|---|---|---|---|
| Open source | ✅ | ❌ | ✅ | ❌ |
| Rendering | Skia (WASM) | Skia (WASM) | SVG | Skia (WASM) |
| AI-native | ✅ MCP | ❌ Plugins only | ❌ | ✅ MCP |
| Self-hosted | ✅ | ❌ | ✅ | ❌ |
| .fig import | ✅ | N/A | ❌ | ❌ |
| Desktop | Tauri | Electron | Browser | Electron |
| Collaboration | CRDT | Proprietary | WebSocket | Proprietary |

## Reusable assets from figma-use

We've built a substantial toolkit in figma-use that transfers directly:

### Figma binary format (Kiwi)
- Full Kiwi encoder/decoder for .fig files
- 533-definition schema (NodeChange with 538 fields)
- Zstd compression/decompression
- Direct WebSocket multiplayer protocol (3000-6000x faster than plugin API)
- Variable binding encoding
- All node types, fills, strokes, effects, transforms

### JSX renderer
- `packages/render` — declarative JSX-to-design-nodes renderer
- Frame, Text, Rect, Ellipse, Line, Star, Polygon, Vector, Icon primitives
- Layout props (flex, gap, padding, justify, items)
- Variable references in colors (`var:Name`, `$Name`)

### Design linter (17 rules)
- `packages/linter` — standalone, reusable as-is
- Design tokens, layout, typography, accessibility, structure rules
- Presets: recommended, strict, accessibility, design-system

### MCP server
- `packages/mcp` — full MCP implementation for AI agents
- All design operations as MCP tools
- Battle-tested with Claude, works with any MCP client

### XPath query engine
- `packages/plugin/src/query.ts` — query nodes by type, attributes, structure
- `//FRAME[@width > 100]`, `//TEXT[contains(@name, 'Button')]`

### Export pipeline
- JSX export with icon matching (Iconify)
- Storybook generation (React/Vue)
- Font extraction (Google Fonts CSS)
- Screenshot/PNG/SVG/PDF export

### Analyze tools
- Cluster detection (repeated patterns → potential components)
- Color palette analysis with similarity merging
- Typography audit (font combinations, sizes, weights)
- Spacing analysis (grid compliance check)
- Accessibility tree snapshot

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Tauri Shell                              │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                     Editor (Web)                           │  │
│  │                                                            │  │
│  │  ┌─────────────────┐  ┌─────────────────────────────────┐ │  │
│  │  │   React UI      │  │    Skia CanvasKit (WASM, 7MB)   │ │  │
│  │  │                 │  │    - Vector rendering            │ │  │
│  │  │  - Toolbar      │  │    - Text shaping               │ │  │
│  │  │  - Panels       │  │    - Image processing           │ │  │
│  │  │  - Properties   │  │    - Effects (blur, shadow)     │ │  │
│  │  │  - Layers       │  │    - Export (PNG, SVG, PDF)     │ │  │
│  │  │  - Variables    │  │                                  │ │  │
│  │  │  - AI Chat      │  └─────────────────────────────────┘ │  │
│  │  └─────────────────┘                                      │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │                  Core Engine (TS)                     │ │  │
│  │  │                                                      │ │  │
│  │  │  SceneGraph ─── Layout (Yoga) ─── Selection          │ │  │
│  │  │      │                                  │             │ │  │
│  │  │  Undo/Redo ─── Constraints ─── Hit Testing           │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │              File Format Layer                        │ │  │
│  │  │                                                      │ │  │
│  │  │  .openpencil (Kiwi binary, same codec as .fig)       │ │  │
│  │  │  .fig import ── .pen import ── .svg/.png export      │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    MCP Server (TS/Bun)                     │  │
│  │                                                            │  │
│  │  batch_get ── batch_design ── screenshot ── get_layout    │  │
│  │  get_guidelines ── get_style_guide ── variables           │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                  Collaboration (opt)                       │  │
│  │                                                            │  │
│  │  CRDT sync ── Cursors ── Comments ── Version history      │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Tools (complete list)

Everything a designer needs, organized by what you're doing.

### Editor layout

Follows Figma's UI3 layout (introduced Config 2024) — toolbar at the bottom, navigation on the left, properties on the right. This is the modern standard designers expect.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Navigation panel (left)  │              Canvas                │ Properties panel (right) │
│                          │                                    │                          │
│ ┌──────────────────────┐ │                                    │ ┌──────────────────────┐ │
│ │ 📄 File name      ▾  │ │                                    │ │ Appearance           │ │
│ ├──────────────────────┤ │                                    │ │ ┌──────────────────┐ │ │
│ │ Layers │ Assets │ Pages│ │         ┌─────────────────┐       │ │ │ W: 400  H: 300   │ │ │
│ ├──────────────────────┤ │         │                 │       │ │ │ X: 100  Y: 200   │ │ │
│ │ ▾ 🔲 Header          │ │         │  Selected Frame │       │ │ │ R: 0°             │ │ │
│ │   ├── T  Logo        │ │         │                 │       │ │ └──────────────────┘ │ │
│ │   ├── 🔲 Nav         │ │         └─────────────────┘       │ ├──────────────────────┤ │
│ │   │   ├── T  Home    │ │                                    │ │ Layout               │ │
│ │   │   └── T  About   │ │     ┌──────────┐                  │ │ Auto layout  →  ↓  ↩ │ │
│ │   └── ◆ CTA Button   │ │     │  Card     │                  │ │ Gap: 16  Pad: 20     │ │
│ │ ▾ 🔲 Hero            │ │     │           │                  │ ├──────────────────────┤ │
│ │   ├── T  Heading      │ │     └──────────┘                  │ │ Position             │ │
│ │   └── ○ Avatar        │ │                                    │ │ Constraints: ◫       │ │
│ │ ▸ 🔲 Footer           │ │                                    │ ├──────────────────────┤ │
│ │                        │ │                                    │ │ Fill                 │ │
│ │                        │ │                                    │ │ ■ #3B82F6    100%  + │ │
│ │                        │ │                                    │ ├──────────────────────┤ │
│ │                        │ │                                    │ │ Stroke               │ │
│ │                        │ │                                    │ │ (none)             + │ │
│ │                        │ │                                    │ ├──────────────────────┤ │
│ │                        │ │                                    │ │ Effects              │ │
│ │                        │ │                                    │ │ (none)             + │ │
│ │                        │ │                                    │ ├──────────────────────┤ │
│ │                        │ │                                    │ │ Export               │ │
│ │                        │ │                                    │ │ (none)             + │ │
│ └──────────────────────┘ │                                    │ └──────────────────────┘ │
│                          │                                    │                          │
├──────────────────────────┴────────────────────────────────────┴──────────────────────────┤
│                                    Toolbar (bottom)                                      │
│  ▶ Select │ # Frame ▾ │ □ Shape ▾ │ ✎ Pen ▾ │ T Text │ 🤚 Hand │ 💬 Comment │ ⚡Actions │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Three panels:**
- **Navigation panel (left)** — tabs for Layers, Assets (component library), Pages. File name + actions dropdown at top. Resizable, collapsible.
- **Canvas (center)** — infinite canvas with zoom/pan. All design work happens here.
- **Properties panel (right)** — context-sensitive. Sections: Appearance (size, position, rotation), Layout (auto-layout / grid), Position (constraints), Fill, Stroke, Effects, Export. Resizable.
- **Toolbar (bottom)** — design tools in a horizontal strip. Frees up vertical space on canvas. Includes the Actions menu (AI, plugins, productivity shortcuts).

**Why bottom toolbar (Figma UI3 style):**
- More vertical canvas space (design is primarily vertical — phone screens, web pages)
- Tools are closer to where your cursor naturally rests
- Actions menu at the end provides AI/plugin access without cluttering the toolbar
- Consistent with what Figma designers already know (as of April 2025, UI3 is the only Figma UI)

### Toolbar (bottom bar)

Horizontal strip at the bottom of the canvas. Tools grouped with subtle dividers. Some tools have a ▾ dropdown for nested tools.

```
┌─────┬─────────┬──────────┬────────┬───────┬───────┬─────────┬──────────┐
│  ▶  │  # ▾    │  □ ▾     │  ✎ ▾   │  T    │  🤚   │  💬     │ ⚡Actions │
│Select│ Frame   │ Shapes   │ Draw   │ Text  │ Hand  │ Comment │          │
│  V   │ Section │ Rect   R │ Pen  P │   T   │   H   │   C     │          │
│  K   │ Slice   │ Ellipse O│Pencil  │       │       │         │          │
│      │         │ Line   L │        │       │       │         │          │
│      │         │ Arrow    │        │       │       │         │          │
│      │         │ Polygon  │        │       │       │         │          │
│      │         │ Star     │        │       │       │         │          │
└─────┴─────────┴──────────┴────────┴───────┴───────┴─────────┴──────────┘
```

**Actions menu (⚡)** — the AI entry point:
- 🤖 AI Chat — open sidebar for conversational design with AI
- Quick actions: create component, auto-layout, tidy up, etc.
- Plugins
- Run MCP tool manually

### Tool options bar

A horizontal bar above the canvas changes based on the active tool. Shows contextual controls the designer needs right now.

| Active tool | Options bar contents |
|---|---|
| **Select** (nothing selected) | *empty* |
| **Select** (node selected) | X, Y, W, H inputs · Rotation · Corner radius · Constraints dropdown |
| **Select** (multiple selected) | Align buttons (6) · Distribute H/V · Tidy up · Boolean ops dropdown |
| **Frame** | Preset sizes dropdown (iPhone 16, Desktop 1440, Custom…) · Fill color · Layout mode toggle |
| **Rectangle** | W, H inputs · Fill color · Corner radius · Stroke toggle |
| **Ellipse** | W, H inputs · Fill color · Arc start/end/ratio |
| **Line** | Length · Stroke color · Stroke weight · Cap style (butt/round/square) · Arrow toggles |
| **Polygon** | Sides (3-12 slider) · Radius · Fill color |
| **Star** | Points (3-20) · Inner radius ratio (0-1) · Fill color |
| **Pen** | Path close toggle · Fill/Stroke toggles · Bend tool |
| **Pencil** | Stroke weight · Smoothing (0-100) · Stroke color |
| **Text** | Font family · Weight · Size · Line height · Letter spacing · Align (L/C/R/J) · Color |
| **Hand** | Zoom level indicator |
| **Comment** | *empty* (click canvas to place) |

### Canvas navigation

| Action | Input | Behavior |
|--------|-------|----------|
| Pan | Space+drag / Middle mouse drag / Two-finger trackpad | Move viewport |
| Zoom in | Cmd+= / Scroll up / Pinch out | Zoom toward cursor position |
| Zoom out | Cmd+- / Scroll down / Pinch in | Zoom toward cursor position |
| Zoom to fit all | Shift+1 | Fit all content in view with padding |
| Zoom to selection | Shift+2 | Fit selected nodes in view |
| Zoom to 100% | Cmd+0 | Reset to actual pixels |
| Zoom to 50%/200% | Cmd+1 / Cmd+2 | Preset zoom levels |
| Pixel preview | — | Render at 1x showing actual pixels |
| Rulers | Shift+R | Toggle rulers on canvas edges |
| Grid | Cmd+' | Toggle layout grid overlay |
| Guides | Drag from ruler | Create horizontal/vertical guide line |
| Minimap | — | Small overview in bottom-right corner (toggle) |

### Selection & manipulation

| Action | Input | Behavior |
|--------|-------|----------|
| Select | Click | Select topmost node under cursor |
| Deep select | Double-click | Enter group/frame, select child |
| Multi-select | Shift+click | Toggle node in selection |
| Marquee select | Drag on empty canvas | Select all nodes intersecting rectangle |
| Move | Drag selected | Move by delta. Shift constrains to axis. Smart guides snap to edges/centers of siblings |
| Resize | Drag handle | 8 handles around selection. Shift constrains proportions. Alt resizes from center |
| Rotate | Hover just outside corner handle → rotate cursor → drag | Rotation. Shift snaps to 15° increments |
| Scale | K then drag | Scale tool, resizes content including text size and stroke weight |
| Nudge | Arrow keys | Move 1px. Shift+arrow moves 10px |
| Duplicate | Alt+drag / Cmd+D | Duplicate in place or at drag position |
| Copy/Paste | Cmd+C / Cmd+V | Clipboard. Paste positions at cursor or center of viewport |
| Copy as CSS | Cmd+Shift+C | Copy selected node's styles as CSS to clipboard |
| Delete | Backspace / Delete | Remove selected nodes |

### Smart guides & snapping

| Feature | Behavior |
|---------|----------|
| Edge snapping | Red lines appear when edges align with siblings (±1px threshold) |
| Center snapping | Vertical/horizontal center lines shown |
| Spacing guides | Pink dimension labels when equal spacing detected between 3+ objects |
| Parent padding | Snap to parent's padding boundaries |
| Grid snapping | Snap to pixel grid (configurable: 1px, 8px, custom) |
| Distance labels | Shows distance (px) between selected node and hovered node |

### Shapes

| Tool | Shortcut | Draw behavior | Modifier keys |
|------|----------|---------------|---------------|
| Frame | F | Click+drag to create sized frame. Click to create default (100×100) | Shift: square. Alt: from center |
| Section | Shift+S | Click+drag to create section region | — |
| Rectangle | R | Click+drag | Shift: square. Alt: from center. Both: square from center |
| Ellipse | O | Click+drag | Shift: circle. Alt: from center |
| Line | L | Click+drag | Shift: constrain to 0°/45°/90° |
| Arrow | Shift+L | Click+drag, auto-adds arrow endpoint | Shift: constrain angle |
| Polygon | — | Click+drag for size, then adjust sides in options bar | Shift: constrain proportions |
| Star | — | Click+drag for outer radius, options bar for points/inner ratio | Shift: constrain proportions |

### Pen & Pencil

| Action | Input | Behavior |
|--------|-------|----------|
| Place point | Click | Straight corner point |
| Place curve point | Click+drag | Bezier curve, drag sets handle length/angle |
| Close path | Click first point | Closes the path |
| Cancel | Escape | Finish open path |
| Continue path | Select endpoint + P | Resume drawing from an existing path end |
| Edit point | Double-click node with Select tool | Enter vector edit mode |
| Move point | Drag point | Move anchor point |
| Adjust handle | Drag handle | Change curve shape. Alt+drag breaks handle symmetry |
| Add point | Click on segment | Insert new anchor point on path |
| Delete point | Select point + Delete | Remove point, path reconnects |
| Toggle straight/curve | Double-click point | Convert between corner and smooth point |
| Bend | Click segment + drag | Convert straight segment to curve |
| Pencil freehand | Shift+P then drag | Freehand stroke, auto-simplified to bezier path |

### Text

| Action | Input | Behavior |
|--------|-------|----------|
| Create text box | T then click | Auto-width text, grows horizontally |
| Create fixed-width text | T then click+drag | Fixed width, wraps and grows vertically |
| Edit text | Double-click text node | Enter text editing mode |
| Select word | Double-click word | Select word |
| Select paragraph | Triple-click | Select paragraph |
| Select all | Cmd+A (in text edit mode) | Select all text in this text node |
| Bold range | Select text + Cmd+B | Toggle bold on selection |
| Italic range | Select text + Cmd+I | Toggle italic on selection |
| Underline | Select text + Cmd+U | Toggle underline |
| Strikethrough | Select text + Cmd+Shift+X | Toggle strikethrough |
| Change font/size | Select text + use options bar | Mixed styles within one text box |
| Bulleted list | Select + options bar | Toggle unordered list |
| Numbered list | Select + options bar | Toggle ordered list |
| Link | Select text + Cmd+K | Add hyperlink |
| Exit text edit | Escape / Click outside | Return to Select tool |

**Text auto-resize modes:**
- **None** — fixed width and height, clips overflow
- **Height** — fixed width, grows vertically to fit content
- **Width and height** — grows both directions to fit content
- **Truncate** — fixed size, shows ellipsis (…) on overflow

### Properties panel (right side)

Context-sensitive. Sections are grouped to match Figma UI3's modern layout. Sections collapse/expand. The panel is resizable.

**Header row** — shows selection name, component status, and quick actions (mask, create component, boolean ops, more ⋯ menu).

**Appearance section:**
- W, H inputs (width, height)
- Rotation input (degrees)
- Corner radius: uniform input, click 🔓 for independent corners (TL, TR, BR, BL)
- Corner smoothing slider (0-100%, squircle)
- Opacity slider 0-100%
- Blend mode dropdown (18 modes)
- Clip content checkbox

**Layout section:**
- Shows "Use auto layout" button when no layout set
- When auto-layout active: direction, gap, padding, justify, align, child sizing (see Layout panel details below)
- When grid active: template columns/rows, gaps (see Grid layout details below)

**Position section:**
- X, Y inputs (absolute position on canvas)
- Constraints visual picker (box with pin toggles for each edge + center)
- Horizontal: left / right / left+right / center / scale
- Vertical: top / bottom / top+bottom / center / scale
- "Ignore auto layout" toggle (absolute position within auto-layout parent)

**Fill section:**
- Add/remove fills (multiple fills supported, stacked with blend modes)
- Types: solid, linear gradient, radial gradient, angular gradient, diamond gradient, image
- Color picker: HSB/RGB/Hex input, opacity slider, eyedropper tool (I)
- Gradient editor: add/remove stops, drag stop positions, edit stop colors
- Image fill: tile/fill/fit/crop modes, exposure/contrast/saturation filters
- Variable binding: click 🔗 icon → pick variable from collection

**Stroke section:**
- Add/remove strokes (multiple supported)
- Color (same as fill)
- Weight: number input (supports independent per-side: top/right/bottom/left)
- Alignment: inside / center / outside
- Dashes: gap and dash length inputs (or preset patterns)
- Cap: butt / round / square
- Join: miter / bevel / round
- Variable binding for color

**Effects section:**
- Add/remove effects (stackable)
- Drop shadow: color, X offset, Y offset, blur, spread, show behind node toggle
- Inner shadow: color, X offset, Y offset, blur, spread
- Layer blur: radius
- Background blur: radius

**Export section:**
- Add export presets: format (PNG/SVG/PDF/JPG) + scale (0.5x-4x) + suffix
- Multiple presets per node
- Export selected: Cmd+Shift+E

### Layout panel (auto-layout frames)

Appears in properties panel when a frame with layout is selected.

```
┌─────────────────────────────────────┐
│ Auto Layout                    [X]  │  ← click X to remove layout
├─────────────────────────────────────┤
│ Direction: [→] [↓] [↩]             │  ← horizontal / vertical / wrap
│ Gap: [16]  Padding: [20]  [🔓]     │  ← unlock for per-side padding
│                                     │
│ Justify: [≡] start/center/end/between/around/evenly
│ Align:   [≡] start/center/end/stretch/baseline
│                                     │
│ ─── Children sizing ───             │
│ Primary: Fixed / Fill / Hug         │
│ Counter: Fixed / Fill / Hug         │
│ Min W: [__] Max W: [__]            │
│ Min H: [__] Max H: [__]            │
└─────────────────────────────────────┘
```

**CSS Grid mode** (when Yoga supports it):
```
┌─────────────────────────────────────┐
│ Grid Layout                    [X]  │
├─────────────────────────────────────┤
│ Columns: [1fr] [1fr] [1fr]    [+]  │  ← add/remove/edit tracks
│ Rows:    [auto] [auto]        [+]  │
│ Col gap: [16]  Row gap: [12]        │
└─────────────────────────────────────┘
```

### Layers panel

Left side panel. Tree view of the document.

```
┌──────────────────────────────────────┐
│ 📄 Page 1  ▾                        │  ← page selector dropdown
├──────────────────────────────────────┤
│ ▾ 🔲 Header                    👁 🔒│
│   ├── T  Logo text              👁  │
│   ├── 🔲 Nav                    👁  │
│   │   ├── T  Home               👁  │
│   │   ├── T  About              👁  │
│   │   └── T  Contact            👁  │
│   └── ◆ CTA Button (instance)  👁  │
│ ▾ 🔲 Hero Section              👁  │
│   ├── T  Heading                👁  │
│   ├── T  Subheading             👁  │
│   └── ○ Avatar                  👁  │
│ ▸ 🔲 Footer (collapsed)        👁  │
└──────────────────────────────────────┘
```

| Action | Input | Behavior |
|--------|-------|----------|
| Select layer | Click | Select corresponding node on canvas |
| Multi-select | Cmd+click | Add/remove from selection |
| Range select | Shift+click | Select range between last selected and clicked |
| Expand/collapse | Click ▸/▾ | Toggle children visibility |
| Rename | Double-click name | Inline rename |
| Reorder | Drag layer | Move in tree (changes z-order and parent) |
| Toggle visibility | Click 👁 | Show/hide node |
| Toggle lock | Click 🔒 | Lock/unlock node |
| Drag into frame | Drag layer onto another layer | Reparent node |
| Search | Cmd+F in panel | Filter layers by name |

### Components

| Action | How |
|--------|-----|
| Create component | Select frame → Right-click → "Create component" or Cmd+Alt+K |
| Create instance | Drag component from assets panel or Alt+drag existing instance |
| Detach instance | Right-click instance → "Detach instance" |
| Reset overrides | Right-click instance → "Reset all overrides" |
| Edit main component | Double-click instance → "Go to main component" |
| Create variant | Select component → "+" button in properties → set variant property values |
| Swap variant | Select instance → variant dropdown in properties panel |
| Add component prop | Select main component → properties panel → "+" next to properties section |
| Component prop types | Text (overridable string), Boolean (show/hide layer), Instance swap (replace nested instance), Variant (select variant) |

### Variables panel

Separate panel (tab alongside properties), or modal.

```
┌──────────────────────────────────────┐
│ Variables                            │
├──────────────────────────────────────┤
│ 📁 Colors                      [+]  │  ← collection
│   Modes: [Light] [Dark]        [+]  │
│   ─────────────────────────────────  │
│   Primary     🟦 #3B82F6  🟦 #60A5FA│
│   Secondary   🟪 #8B5CF6  🟪 #A78BFA│
│   Background  ⬜ #FFFFFF  ⬛ #0F172A│
│   Text        ⬛ #1E293B  ⬜ #F8FAFC│
│                                      │
│ 📁 Spacing                     [+]  │
│   SM   4                             │
│   MD   8                             │
│   LG   16                            │
│   XL   32                            │
│                                      │
│ 📁 Typography                  [+]  │
│   Body Size     16                   │
│   Heading Size  32                   │
└──────────────────────────────────────┘
```

| Action | How |
|--------|-----|
| Create collection | "+" button at top → name collection → add modes |
| Create variable | "+" inside collection → type (color/number/string/boolean) → name → values per mode |
| Bind to node | Select node → click 🔗 in fill/stroke/text/etc. → pick variable |
| Edit variable | Click value cell → edit inline |
| Switch mode | Top-right mode switcher in canvas → all bound properties update live |
| Alias variable | Set variable value to reference another variable |

### Boolean Operations

| Operation | Shortcut | Description |
|-----------|----------|-------------|
| Union | Cmd+Shift+U | Combine shapes |
| Subtract | Cmd+Shift+S | Cut one shape from another |
| Intersect | Cmd+Shift+I | Keep overlapping area |
| Exclude | Cmd+Shift+E | Keep non-overlapping areas |
| Flatten | Cmd+E | Merge into single vector |

### Alignment & distribution

Available when 2+ nodes selected. Shown in options bar and right-click menu.

| Action | Shortcut | Description |
|--------|----------|-------------|
| Align left | Alt+A | Align left edges |
| Align horizontal center | Alt+H | Align horizontal centers |
| Align right | Alt+D | Align right edges |
| Align top | Alt+W | Align top edges |
| Align vertical center | Alt+V | Align vertical centers |
| Align bottom | Alt+S | Align bottom edges |
| Distribute horizontally | Ctrl+Alt+H | Equal horizontal spacing |
| Distribute vertically | Ctrl+Alt+V | Equal vertical spacing |
| Tidy up | Ctrl+Alt+T | Auto-arrange into grid with equal spacing |
| Match width | — | Set all selected to same width |
| Match height | — | Set all selected to same height |

### Pages

| Action | How |
|--------|-----|
| Switch page | Click page name in layers panel dropdown |
| Create page | "+" next to page dropdown |
| Rename page | Double-click page name |
| Delete page | Right-click → Delete (cannot delete last page) |
| Reorder pages | Drag in dropdown list |
| Duplicate page | Right-click → Duplicate |

### Import & Export

| Format | Import | Export |
|--------|--------|--------|
| .fig (Figma) | ✅ via Kiwi decoder | ❌ |
| .pen (Pencil) | ✅ | ❌ |
| .openpencil | ✅ | ✅ |
| .svg | ✅ | ✅ |
| .png | ✅ (image fill) | ✅ (1x, 2x, 3x) |
| .jpg | ✅ (image fill) | ✅ |
| .pdf | ❌ | ✅ |
| .jsx/.tsx | ❌ | ✅ (React components) |
| CSS | ❌ | ✅ (design tokens, styles) |
| Storybook | ❌ | ✅ (stories + components) |

### AI (MCP) — 118 tools

The editor exposes its **entire** API through MCP. Not a dumbed-down subset — every operation available to a human is available to AI. Ported from figma-use.

#### Create (14 tools)

| Tool | Description |
|------|-------------|
| `create_frame` | Create a frame |
| `create_rect` | Create a rectangle |
| `create_ellipse` | Create an ellipse |
| `create_text` | Create a text node |
| `create_line` | Create a line |
| `create_polygon` | Create a polygon |
| `create_star` | Create a star |
| `create_vector` | Create a vector path |
| `create_component` | Create a component |
| `create_instance` | Create a component instance |
| `create_section` | Create a section |
| `create_page` | Create a page |
| `create_slice` | Create a slice |
| `create_icon` | Create an icon from Iconify |

#### Set / Modify (18 tools)

| Tool | Description |
|------|-------------|
| `set_fill` | Set fill color (hex or variable ref) |
| `set_stroke` | Set stroke color and weight |
| `set_stroke-align` | Set stroke alignment (inside/center/outside) |
| `set_radius` | Set corner radius (uniform or per-corner) |
| `set_opacity` | Set opacity |
| `set_rotation` | Set rotation angle |
| `set_blend` | Set blend mode |
| `set_visible` | Set visibility |
| `set_locked` | Set locked state |
| `set_text` | Set text content |
| `set_text-resize` | Set text auto resize mode |
| `set_font` | Set font properties |
| `set_font-range` | Set font properties for a text range |
| `set_effect` | Set effect (shadow, blur) |
| `set_image` | Set image fill from file |
| `set_layout` | Set auto-layout properties |
| `set_constraints` | Set resize constraints |
| `set_minmax` | Set min/max width and height |
| `set_props` | Set instance component properties |

#### Node Operations (15 tools)

| Tool | Description |
|------|-------------|
| `node_get` | Get node properties |
| `node_tree` | Get node tree with properties |
| `node_children` | Get child nodes |
| `node_ancestors` | Get ancestor chain to root |
| `node_bounds` | Get bounding box |
| `node_bindings` | Get variable bindings for fills/strokes |
| `node_move` | Move a node |
| `node_resize` | Resize a node |
| `node_rename` | Rename a node |
| `node_clone` | Clone node(s) |
| `node_delete` | Delete node(s) |
| `node_set-parent` | Reparent a node |
| `node_replace-with` | Replace node with another node or JSX |
| `node_to-component` | Convert frame(s) to component(s) |
| `find` | Find nodes by name or type |

#### Variables & Collections (11 tools)

| Tool | Description |
|------|-------------|
| `variable_list` | List all variables |
| `variable_get` | Get variable by ID |
| `variable_find` | Find variables by name pattern |
| `variable_create` | Create a variable |
| `variable_set` | Set variable value for mode |
| `variable_bind` | Bind variable to node property |
| `variable_delete` | Delete a variable |
| `collection_list` | List variable collections |
| `collection_get` | Get collection by ID |
| `collection_create` | Create a variable collection |
| `collection_delete` | Delete a collection |

#### Components (4 tools)

| Tool | Description |
|------|-------------|
| `component_add-prop` | Add property to component |
| `component_edit-prop` | Edit component property |
| `component_delete-prop` | Delete component property |
| `component_combine` | Combine components into a component set (variants) |

#### Styles (4 tools)

| Tool | Description |
|------|-------------|
| `style_list` | List local styles |
| `style_create-paint` | Create a paint/color style |
| `style_create-text` | Create a text style |
| `style_create-effect` | Create an effect style |

#### Boolean Operations (4 tools)

| Tool | Description |
|------|-------------|
| `boolean_union` | Union shapes |
| `boolean_subtract` | Subtract shapes |
| `boolean_intersect` | Intersect shapes |
| `boolean_exclude` | Exclude shapes |

#### Vector Paths (5 tools)

| Tool | Description |
|------|-------------|
| `path_get` | Get vector path data |
| `path_set` | Set vector path data |
| `path_move` | Move all path points by offset |
| `path_scale` | Scale path from center |
| `path_flip` | Flip path horizontally or vertically |

#### Groups (3 tools)

| Tool | Description |
|------|-------------|
| `group_create` | Group nodes |
| `group_ungroup` | Ungroup nodes |
| `group_flatten` | Flatten nodes into single vector |

#### Analyze (5 tools)

| Tool | Description |
|------|-------------|
| `analyze_colors` | Analyze color palette usage |
| `analyze_typography` | Analyze typography usage |
| `analyze_spacing` | Analyze spacing values (gap, padding) |
| `analyze_clusters` | Find repeated patterns (potential components) |
| `analyze_snapshot` | Generate accessibility tree snapshot |

#### Export (6 tools)

| Tool | Description |
|------|-------------|
| `export_node` | Export node as image |
| `export_screenshot` | Screenshot current viewport |
| `export_selection` | Export selection as image |
| `export_jsx` | Export node as JSX component |
| `export_storybook` | Export components as Storybook stories |
| `export_fonts` | List fonts used in the current page |

#### Diff (5 tools)

| Tool | Description |
|------|-------------|
| `diff_create` | Create a diff patch between two nodes/trees |
| `diff_show` | Show diff between current state and provided props |
| `diff_apply` | Apply a diff patch |
| `diff_visual` | Create visual diff between two nodes as PNG |
| `diff_jsx` | Show JSX diff between two nodes |

#### Pages & Viewport (7 tools)

| Tool | Description |
|------|-------------|
| `page_list` | List all pages |
| `page_current` | Get current page |
| `page_set` | Switch to page by ID or name |
| `page_bounds` | Get bounding box of all objects on page |
| `viewport_get` | Get viewport position and zoom |
| `viewport_set` | Set viewport position and zoom |
| `viewport_zoom-to-fit` | Zoom to fit nodes |

#### Selection & Connectors (6 tools)

| Tool | Description |
|------|-------------|
| `selection_get` | Get selected nodes |
| `selection_set` | Set selection |
| `connector_create` | Create a connector between two nodes |
| `connector_get` | Get connector details |
| `connector_set` | Update connector properties |
| `connector_list` | List connectors on page |

#### Meta & Escape Hatch (7 tools)

| Tool | Description |
|------|-------------|
| `status` | Check connection status |
| `lint` | Lint design for consistency and accessibility |
| `import` | Import SVG |
| `render` | Render JSX to design nodes (Frame, Rect, Ellipse, Text, Line, Star, Polygon, Vector, Group, Icon) |
| `get_components` | Get all components |
| `get_styles` | Get all local styles |
| `get_pages` | Get all pages |
| `font_list` | List available fonts |
| `comment_watch` | Wait for new comment and return its content |
| `eval` | Execute JavaScript in editor context |

**AI workflow:**
1. AI reads structure: `node_tree`, `find`, `analyze_*`
2. AI creates/modifies: `create_*`, `set_*`, `node_*`, `render` (JSX)
3. AI verifies visually: `export_screenshot` → inspects the image
4. AI iterates: `diff_create` to see what changed, fix issues
5. AI exports: `export_jsx`, `export_storybook` for developer handoff

### Prototyping

| Feature | Description |
|---------|-------------|
| Connections | Link frames with interaction triggers |
| Triggers | Click, hover, press, mouse enter/leave, after delay, drag |
| Actions | Navigate to, overlay, swap, back, scroll to, open URL |
| Transitions | Instant, dissolve, smart animate, move in/out, push, slide |
| Easing | Linear, ease-in, ease-out, ease-in-out, spring, custom bezier |
| Preview | Play prototype in browser |
| Device frames | iPhone, Android, Desktop, custom sizes |

### Comments

| Feature | Description |
|---------|-------------|
| Pin comments | Click anywhere on canvas to leave a comment |
| Threads | Reply to comments |
| Resolve | Mark comments as resolved |
| Mentions | @mention team members |

---

---

## Technical Deep Dive

### Scene Graph

The scene graph is a tree of nodes. Every node is identified by a GUID (`sessionID:localID`) and has a parent reference via `ParentIndex` (parent GUID + position string for z-ordering).

We reuse Figma's proven schema — 194 message/enum/struct definitions, with `NodeChange` as the central type (~390 fields after removing deprecated tag fields).

#### Node hierarchy

```
Document
└── Canvas (page)
    ├── Frame
    │   ├── Rectangle
    │   ├── Text
    │   └── Frame (nested)
    │       ├── Ellipse
    │       └── Instance (→ references Component)
    ├── Component
    │   └── ...children (the main component definition)
    ├── Section
    │   └── Frame
    ├── Group
    │   └── ...children
    └── BooleanOperation
        └── ...operand shapes
```

#### Node types (29, from Figma Kiwi schema)

| Type | ID | Description |
|------|----|-------------|
| DOCUMENT | 1 | Root, one per file |
| CANVAS | 2 | Page |
| GROUP | 3 | Group container |
| FRAME | 4 | Primary container (artboard), supports auto-layout |
| BOOLEAN_OPERATION | 5 | Union/subtract/intersect/exclude result |
| VECTOR | 6 | Freeform vector path |
| STAR | 7 | Star shape |
| LINE | 8 | Line |
| ELLIPSE | 9 | Ellipse/circle, supports arc data |
| RECTANGLE | 10 | Rectangle |
| REGULAR_POLYGON | 11 | Regular polygon (3-12 sides) |
| ROUNDED_RECTANGLE | 12 | Rectangle with smooth corners |
| TEXT | 13 | Text with rich formatting |
| SLICE | 14 | Export region |
| SYMBOL | 15 | Component (main) |
| INSTANCE | 16 | Component instance |
| STICKY | 17 | FigJam sticky note |
| SHAPE_WITH_TEXT | 18 | FigJam shape |
| CONNECTOR | 19 | Connector line between nodes |
| CODE_BLOCK | 20 | FigJam code block |
| WIDGET | 21 | Plugin widget |
| STAMP | 22 | FigJam stamp |
| MEDIA | 23 | Video/GIF |
| HIGHLIGHT | 24 | FigJam highlight |
| SECTION | 25 | Canvas section (organizational) |
| SECTION_OVERLAY | 26 | Section overlay |
| WASHI_TAPE | 27 | FigJam washi tape |
| VARIABLE | 28 | Variable definition node |

#### Core node properties

Every node carries these fields (subset of NodeChange):

```
Identity:     guid, type, name, phase (CREATED/REMOVED)
Tree:         parentIndex (parent GUID + position string)
Transform:    size (Vector), transform (2x3 Matrix), rotation
Appearance:   fillPaints[], strokePaints[], effects[], opacity, blendMode
Stroke:       strokeWeight, strokeAlign, strokeCap, strokeJoin, dashPattern[]
              borderTopWeight, borderBottomWeight, borderLeftWeight, borderRightWeight
              borderStrokeWeightsIndependent
Corners:      cornerRadius, cornerSmoothing
              rectangleTopLeftCornerRadius, rectangleTopRightCornerRadius
              rectangleBottomLeftCornerRadius, rectangleBottomRightCornerRadius
              rectangleCornerRadiiIndependent
Visibility:   visible, locked
Constraints:  horizontalConstraint, verticalConstraint
```

Type-specific fields:

```
Text:         textData (characters, styleOverrides, baselines, glyphs)
              fontSize, fontName, lineHeight, letterSpacing, paragraphSpacing
              textAlignHorizontal, textAlignVertical, textAutoResize, textTruncation
              textCase, textDecoration, textListData
              fontVariant* (ligatures, numeric, caps, position)
              fontVariations[], hyperlink
Vector:       vectorData (vectorNetworkBlob, normalizedSize)
              fillGeometry[], strokeGeometry[]
              handleMirroring, arcData (for ellipse arcs)
Star:         starInnerScale, count (point count)
Component:    symbolData, componentKey, symbolDescription
              componentPropDefs[], isSymbolPublishable
              sharedComponentMasterData, sharedSymbolMappings[]
Instance:     overriddenSymbolID, symbolData.symbolOverrides[]
              componentPropRefs[], componentPropAssignments[]
              overrideStash[], propsAreBubbled
Layout:       stackMode (NONE/HORIZONTAL/VERTICAL)
              stackSpacing, stackPadding, stackHorizontalPadding, stackVerticalPadding
              stackPaddingRight, stackPaddingBottom
              stackJustify, stackCounterAlign, stackCounterAlignItems
              stackPrimaryAlignItems, stackPositioning, stackReverseZIndex
              stackPrimarySizing, stackCounterSizing, stackChildPrimaryGrow
              stackChildAlignSelf
              bordersTakeSpace, resizeToFit
Grid:         gridRowCount, gridColumnCount
              gridRowGap, gridColumnGap
              gridColumnSizes[], gridRowSizes[] (GridTrackSize: type + value)
Styles:       inheritFillStyleID, inheritStrokeStyleID, inheritTextStyleID
              inheritEffectStyleID, inheritGridStyleID
              styleType, styleDescription
Prototype:    prototypeInteractions[] (event + actions[])
              transitionNodeID, transitionType, transitionDuration, easingType
              overlayPositionType, overlayRelativePosition
              prototypeStartingPoint, prototypeStartNodeID
Variables:    variableData (value + dataType for BOOLEAN/FLOAT/STRING)
              Paint.variableBinding (binds fill/stroke color to variable GUID)
Export:       exportSettings[], exportBackgroundDisabled
Plugin:       pluginData[], pluginRelaunchData[]
Accessibility: ariaRole, accessibleLabel
Connectors:   connectorStart, connectorEnd, connectorLineStyle
              connectorStartCap, connectorEndCap, connectorControlPoints[]
```

#### Paint (fill/stroke)

```
Paint {
  type:       SOLID | GRADIENT_LINEAR | GRADIENT_RADIAL | GRADIENT_ANGULAR
              | GRADIENT_DIAMOND | IMAGE | EMOJI | VIDEO
  color:      {r, g, b, a} (0-1 floats)
  opacity:    0-1
  visible:    bool
  blendMode:  NORMAL | MULTIPLY | SCREEN | ... (18 modes)
  stops:      ColorStop[] (for gradients: color + position)
  transform:  Matrix (for gradient/image positioning)
  image:      Image{hash, name, dataBlob}
  imageScaleMode: TILE | FILL | FIT | CROP
  paintFilter: tint, shadows, highlights, exposure, temperature, vibrance, contrast
  variableBinding: PaintVariableBinding (binds color to variable GUID)
}
```

#### Effect

```
Effect {
  type:       INNER_SHADOW | DROP_SHADOW | FOREGROUND_BLUR | BACKGROUND_BLUR
  color:      {r, g, b, a}
  offset:     {x, y}
  radius:     float (blur radius)
  spread:     float (shadow spread)
  visible:    bool
  blendMode:  BlendMode
  showShadowBehindNode: bool
}
```

#### In-memory representation

Nodes live in a flat `Map<string, Node>` keyed by GUID string. The tree structure is maintained via `parentIndex` references. This gives O(1) lookup by ID and efficient traversal.

```typescript
interface SceneGraph {
  nodes: Map<string, Node>
  root: string                    // Document GUID
  
  getNode(id: string): Node
  getChildren(id: string): Node[] // Sorted by position string
  getParent(id: string): Node | null
  
  createNode(type: NodeType, parent: string, props: Partial<NodeChange>): Node
  updateNode(id: string, changes: Partial<NodeChange>): void
  deleteNode(id: string): void
  moveNode(id: string, newParent: string, position: string): void
  
  // Queries
  findByType(type: NodeType): Node[]
  findByName(pattern: string): Node[]
  hitTest(point: Vector, canvas: string): Node | null
  getNodesInRect(rect: Rect, canvas: string): Node[]
}
```

### Undo/Redo

Figma's own approach (visible in the Message schema): `Message.localUndoStack` and `Message.localRedoStack` — each undo entry is a full `Message` containing the inverse `NodeChange[]`.

We use the same **inverse command** pattern:

```typescript
interface UndoEntry {
  label: string                   // "Create Rectangle", "Change fill", etc.
  forward: NodeChange[]           // Changes to apply
  inverse: NodeChange[]           // Changes to revert (auto-computed)
  timestamp: number
}

interface UndoManager {
  undoStack: UndoEntry[]
  redoStack: UndoEntry[]
  
  apply(changes: NodeChange[], label: string): void  // Pushes inverse onto undoStack
  undo(): void                                        // Pops undoStack, pushes to redoStack
  redo(): void                                        // Pops redoStack, pushes to undoStack
  
  beginBatch(label: string): void  // Group multiple changes into one undo step
  commitBatch(): void
}
```

How inverse computation works:

| Operation | Forward | Inverse |
|-----------|---------|---------|
| Create node | `{guid, phase: CREATED, ...props}` | `{guid, phase: REMOVED}` |
| Delete node | `{guid, phase: REMOVED}` | `{guid, phase: CREATED, ...allProps}` (snapshot) |
| Change prop | `{guid, fill: "#F00"}` | `{guid, fill: "#00F"}` (previous value) |
| Move node | `{guid, parentIndex: newParent}` | `{guid, parentIndex: oldParent}` |
| Reparent | `{guid, parentIndex: newParent}` | `{guid, parentIndex: oldParent}` |

Before applying any change, we snapshot the affected fields. The snapshot becomes the inverse. This is simple, correct, and the exact pattern Figma uses.

**Batching:** operations like "drag to move" produce hundreds of position changes per second. We debounce into a single undo entry. `beginBatch`/`commitBatch` wraps multi-step operations (e.g., "create component" = create frame + set symbolData + create children).

### Figma Compatibility & Pixel-Perfect Testing

The goal: open any `.fig` file and render it identically to Figma.

#### .fig file format

```
┌─────────────────────────────────┐
│ Magic header: "fig-kiwi" (8B)   │
│ Version (4B uint32 LE)          │
│ Schema length (4B uint32 LE)    │
│ Compressed Kiwi schema          │
│ Message length (4B uint32 LE)   │
│ Compressed Kiwi message         │  ← NodeChange[] (the entire document)
│ Blob data                       │  ← Images, vector networks, fonts
└─────────────────────────────────┘
```

We already have the full pipeline from figma-use:
- **Kiwi schema**: 194 definitions, 2178 lines (in git: `9216dcc^:packages/cli/src/multiplayer/schema.ts`)
- **Codec**: encode/decode Messages with Kiwi, Zstd compress/decompress (`codec.ts`, 546 lines)
- **Protocol**: wire format parsing, message type detection (`protocol.ts`, 238 lines)
- **Client**: WebSocket multiplayer connection (`client.ts`, 351 lines)

#### Import pipeline

```
.fig file
  → parse header (magic + version)
  → decompress Zstd
  → decode Kiwi schema
  → decode Message → NodeChange[]
  → build SceneGraph (flat map of nodes)
  → resolve blob references (images, vector networks)
  → apply to OpenPencil scene graph
```

#### Rendering compatibility

Both OpenPencil and Figma use Skia CanvasKit for rendering. This means identical rendering primitives. The pixel-perfect challenge is in:

1. **Layout computation** — auto-layout (flexbox) results must match exactly. Using Yoga helps since Figma's layout is also CSS-flexbox-based, but we need to verify edge cases.
2. **Text shaping** — same font + same Skia text shaper = same glyphs. We must use the same fonts (embedded in .fig blobs or loaded from the same sources).
3. **Effect rendering** — shadows, blurs, blend modes are Skia-native, should match.
4. **Vector path rendering** — vector networks are stored as blobs, need exact reproduction of fill/stroke geometry.
5. **Corner smoothing** — Figma's "smooth corners" (squircle) uses `cornerSmoothing` (0-1). Skia doesn't have native squircle — needs a custom path approximation matching Figma's implementation.
6. **Subpixel positioning** — rounding differences at fractional coordinates.

#### Fuzzy pixel-perfect test suite

```
Crawl Figma files → for each:
  1. Export from Figma (via REST API or screenshot):
     figma-use export node <id> --scale 2 --output expected.png
  
  2. Import .fig into OpenPencil
  
  3. Render same node in OpenPencil:
     openpencil render <id> --scale 2 --output actual.png
  
  4. Compare with pixelmatch:
     - Threshold: 0.1 (allow minor subpixel differences)
     - Report: diff percentage, diff image, failing regions
     - Pass if < 0.5% pixels differ
```

**Test corpus structure:**

```
tests/figma-compat/
├── corpus/
│   ├── basic-shapes.fig          # Rectangles, ellipses, lines, stars, polygons
│   ├── auto-layout.fig           # Flexbox: horizontal, vertical, nested, wrap
│   ├── grid-layout.fig           # CSS Grid layouts
│   ├── text-styles.fig           # Fonts, sizes, line heights, letter spacing, mixed styles
│   ├── effects.fig               # Shadows, blurs, blend modes
│   ├── gradients.fig             # Linear, radial, angular, diamond, image fills
│   ├── components.fig            # Components, instances, overrides, variants
│   ├── constraints.fig           # Pin constraints, scale, fill container
│   ├── vectors.fig               # Pen tool paths, boolean operations
│   ├── corner-smoothing.fig      # Squircle / smooth corners at various values
│   ├── masks.fig                 # Mask layers, outline masks
│   ├── variables.fig             # Variable-bound fills, strokes, text
│   └── real-world/
│       ├── landing-page.fig
│       ├── mobile-app.fig
│       └── design-system.fig
├── expected/                     # Screenshots from Figma (ground truth)
│   ├── basic-shapes/
│   │   ├── node-1-2.png
│   │   └── ...
├── actual/                       # Screenshots from OpenPencil (test run)
├── diffs/                        # Visual diffs
└── report.html                   # Test report with side-by-side comparison
```

**CI pipeline:**

```bash
# 1. Crawl: download .fig files and export screenshots from Figma
bun run test:figma:crawl

# 2. Render: import .fig into OpenPencil, render same nodes
bun run test:figma:render

# 3. Compare: pixel diff with threshold
bun run test:figma:compare

# 4. Report: generate HTML report with failures
bun run test:figma:report
```

**Compatibility tiers:**

| Tier | Requirement | What it covers |
|------|-------------|----------------|
| T0 | Exact pixels | Basic shapes, solid fills, positioning, sizing |
| T1 | < 0.1% diff | Auto-layout, text (minor font hinting differences) |
| T2 | < 0.5% diff | Effects, gradients, masks |
| T3 | < 1% diff | Complex components, real-world files |
| T4 | Visual match | Corner smoothing, subpixel rendering edge cases |

### Layout Engine: Yoga

Based on our research, **Yoga** is the right choice now:

- **CSS Grid support is landing** — [facebook/yoga#1893](https://github.com/facebook/yoga/pull/1893)–#1902 (9 PRs by @intergalacticspacehighway from Expo)
  - PR 1/9 (style types & public API) under active review by NickGerleman (Meta), last activity Feb 28, 2026
  - Supported: `grid-template-columns/rows`, `grid-column/row-start/end`, `grid-auto-columns/rows`, `minmax()`, `auto`, `%`, `px`, `fr`
  - Not yet: `repeat()`, `auto-fill`/`auto-fit`, `grid-template-areas`, `grid-auto-flow`, subgrid
- Battle-tested in React Native (billions of devices)
- ~45KB WASM, well-maintained by Meta
- Flexbox + Grid covers everything a design tool needs
- No need to maintain a custom layout engine

We'll wrap Yoga with a thin adapter that speaks our property names (`fill_container` → `flex-grow:1`, `fit_content` → `auto`).

Mapping Figma layout fields to Yoga:

| Figma (NodeChange field) | Yoga equivalent |
|---|---|
| `stackMode: HORIZONTAL` | `flexDirection: row` |
| `stackMode: VERTICAL` | `flexDirection: column` |
| `stackSpacing` | `gap` |
| `stackPadding` / `stackHorizontalPadding` / `stackVerticalPadding` / `stackPaddingRight` / `stackPaddingBottom` | `padding*` |
| `stackJustify` (MIN/CENTER/MAX/SPACE_BETWEEN) | `justifyContent` |
| `stackCounterAlign` / `stackCounterAlignItems` | `alignItems` |
| `stackPrimarySizing: FIXED/HUG/FILL` | `width/height: fixed/auto/flex-grow` |
| `stackCounterSizing: FIXED/HUG/FILL` | Cross-axis sizing |
| `stackChildPrimaryGrow` | `flexGrow` |
| `stackChildAlignSelf` | `alignSelf` |
| `stackPositioning: ABSOLUTE` | `position: absolute` |
| `gridRowCount` / `gridColumnCount` | CSS Grid `grid-template-rows/columns` count |
| `gridRowGap` / `gridColumnGap` | `row-gap` / `column-gap` |
| `gridColumnSizes[]` / `gridRowSizes[]` | `grid-template-columns/rows` (track sizes) |

### File Format: Kiwi binary

We already have the full Kiwi codec from figma-use. The `.openpencil` format will use the same encoding:

- Kiwi binary schema (compact, fast parsing)
- Zstd compression
- Same NodeChange-based structure (proven at Figma scale)
- Superset of .fig — we add our own fields but can read Figma files

Migration from .fig: decode with our Kiwi codec → re-encode as .openpencil.

### Collaboration (CRDT)

The multiplayer model follows what we observed in Figma's protocol:

- Each client gets a `sessionID` from the server
- Every node GUID is `{sessionID}:{localID}` — no conflicts
- Changes are `NodeChange[]` messages broadcast to all clients
- Position strings use fractional indexing for z-ordering (no conflicts on concurrent reorder)
- Server is a relay (doesn't interpret node data, just broadcasts)

We use Yjs for the CRDT layer, mapping NodeChange operations to Yjs documents. This gives us:
- Offline editing with automatic merge on reconnect
- Conflict-free concurrent edits
- Built-in awareness protocol (cursors, selection, viewport)

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Rendering | Skia CanvasKit WASM | Same as Figma/Pencil, proven performance |
| UI | React + TypeScript | Ecosystem, hiring, figma-use renderer reusable |
| Styling | Tailwind CSS | Fast iteration |
| State | Zustand | Lightweight, no boilerplate |
| Layout | Yoga WASM | Flexbox + Grid (soon), battle-tested |
| Desktop | Tauri v2 | ~5MB vs Electron's ~100MB, Rust backend |
| AI | MCP (TypeScript) | Protocol-level AI integration |
| Collaboration | Yjs (CRDT) | Proven real-time sync library |
| File format | Kiwi binary + Zstd | Compact, fast, .fig compatible |
| Build | Bun | Fast bundling, native TS |

## Phases

### Phase 1: Core engine (3 months)

SceneGraph, Skia rendering, basic shapes, selection, zoom/pan, undo/redo.

**Deliverable:** draw rectangles, ellipses, frames, move them, undo, zoom.

**Validation:**

| Test | Pass criteria |
|------|---------------|
| SceneGraph unit tests | CRUD nodes, parent-child, z-ordering, hit testing — 100% coverage of core ops |
| Skia rendering tests | Render each primitive (rect, ellipse, line, star, polygon, vector path) → compare PNG output against reference images, <0.1% pixel diff |
| Transform tests | Rotation, scaling, nested transforms → verify computed bounding boxes match expected values |
| Undo/redo tests | Create 50 random operations, undo all → empty canvas. Redo all → identical state. Property-based testing with fast-check |
| Performance benchmark | 10,000 nodes: scene graph ops <1ms, full render <16ms (60fps), pan/zoom stays interactive |
| Memory test | Create 10,000 nodes, delete all → verify no WASM memory leak (CanvasKit paint/path objects freed) |
| Integration smoke | Open browser → canvas loads → draw rect → move it → undo → redo. Manual but scripted with Playwright |

### Phase 2: Editor UI + Layout (3 months)

Properties panel, layers panel, toolbar, Yoga layout integration, constraints, text editing.

**Deliverable:** functional editor with auto-layout, text, and property editing.

**Validation:**

| Test | Pass criteria |
|------|---------------|
| Yoga layout unit tests | Horizontal, vertical, nested, wrap, gap, padding, justify, align — verify computed positions match CSS flexbox reference (compare against browser rendering of equivalent CSS) |
| Yoga ↔ Figma mapping tests | For each `stack*` field value, verify the Yoga adapter produces identical layout to Figma's auto-layout. Test corpus: 50+ layout configs exported from Figma |
| Grid layout tests | (If Yoga Grid has landed) Template columns/rows, gap, track sizes — compare against CSS Grid reference |
| Text editing tests | Type, select, bold range, change font size mid-text, undo text change — verify textData roundtrips correctly |
| Constraint tests | Pin left, right, center, scale — resize parent frame → verify child positions match expected constraint behavior |
| Panel integration tests | Layers panel reflects tree structure after every operation. Properties panel shows correct values for selected node. Playwright E2E |
| Keyboard shortcuts | Every shortcut in the tools table fires the correct action. Automated with Playwright key simulation |
| Accessibility | All panels keyboard-navigable, ARIA roles correct. axe-core audit passes |

### Phase 3: File format + Import (2 months)

.openpencil format, .fig import (from figma-use Kiwi codec), .svg import/export, PNG/PDF export.

**Deliverable:** open and save files, import from Figma.

**Validation:**

| Test | Pass criteria |
|------|---------------|
| Roundtrip test | Create document → save .openpencil → close → reopen → all nodes, properties, and blobs identical (byte-level comparison of serialized NodeChange[]) |
| .fig import corpus | Import 20+ .fig files of varying complexity. For each: parse succeeds, all nodes present in scene graph, no data loss on known fields |
| Figma pixel-perfect (T0) | Basic shapes .fig → import → render → compare against Figma export. <0.1% diff on rectangles, ellipses, solid fills, positioning |
| Figma pixel-perfect (T1) | Auto-layout .fig files → import → render → <0.5% diff (layout positions must match) |
| SVG import | 50 SVG files from real-world icon sets → import → verify path data preserved, fills/strokes correct |
| SVG export | Export 20 nodes as SVG → re-import → visual diff <0.1% |
| PNG export | Export at 1x, 2x, 3x → verify dimensions are exact, pixel content matches canvas rendering |
| PDF export | Export 5 frames → open in PDF viewer → visual sanity check (automated with pdf2png + pixelmatch) |
| Schema versioning | Open .openpencil v1 file with v2 schema → migration runs without data loss |
| Fuzz test | Feed 1000 random byte sequences to .openpencil parser → no crashes, only clean error messages |

### Phase 4: Components + Variables (2 months)

Components, instances, overrides, variants, variables, collections, modes/themes.

**Deliverable:** design system creation workflow.

**Validation:**

| Test | Pass criteria |
|------|---------------|
| Component create/instantiate | Create component → create 10 instances → override text on instance 3 → verify main component unchanged, instance 3 has override, others inherit |
| Override propagation | Change main component fill → all instances update except those with fill override |
| Variant switching | Create component set with 3 variants → swap variant on instance → correct child structure rendered |
| Component props | Add TEXT prop → set default → verify instance shows default → override on instance → verify override |
| Nested instances | Instance containing instance containing instance → override deeply nested text → verify correct propagation |
| Variables CRUD | Create collection → add 10 variables (color, number, string, boolean) → bind to node properties → verify rendered output uses variable values |
| Theme switching | 2 modes (light/dark) → switch mode → all variable-bound properties update → render matches expected |
| Variable binding roundtrip | Save file with variable bindings → reload → bindings intact, resolved values correct |
| .fig component import | Import .fig with components → instances resolve correctly → overrides preserved |

### Phase 5: AI integration (2 months)

In-app AI chat + MCP server. Two interfaces to the same tool set: chat panel for interactive design, MCP for external agents.

**Deliverable:** AI can design full interfaces through the chat panel or MCP.

#### In-app AI chat

**No backend.** Everything runs in the browser. The user provides their own OpenRouter API key. The app calls OpenRouter directly via `fetch()` — no proxy server, no sidecar, no extra process.

```
Browser (Vue)
  ChatPanel.vue
  useChat() ──stream──→  OpenRouter (SSE)
  tool exec (local)      Claude Sonnet
```

Stack: `ai@6.0.0-beta` + `@ai-sdk/valibot` + `@openrouter/ai-sdk-provider` + `valibot`. All client-side — `ai/vue` `useChat()` composable with `fetch` transport directly to OpenRouter.

**Why no backend:** All tools execute client-side (editor store, canvas). A backend would add SSE roundtrip latency on every tool call (10-20 per message), require a Tauri sidecar for production, and add failure modes — all to protect an API key that the user owns. Desktop apps (1Password, Cursor, etc.) use the same model.

**API key storage:**
- **Tauri (desktop):** `tauri-plugin-stronghold` — encrypted vault on disk, key loaded into JS memory at runtime for fetch headers. Never in source code, never in plaintext on disk.
- **Browser mode:** `localStorage` with a clear warning. Acceptable for a local-first design tool — no worse than any SPA with user-provided keys.

**Chat panel UI:** Replaces right sidebar (properties panel) when active, toggled with `⌘J`. Both share the same splitter slot. Tool calls render inline as a collapsible timeline (like beebro-chat's `ToolTimeline`) with icons, status, expandable params/results. Screenshots and visual diffs render inline as thumbnails.

#### AI workflow (from figma-use)

```
1. Read    → snapshot (compact a11y tree), get_page_tree, find_nodes
2. Create  → render (JSX), set_* for edits
3. Verify  → screenshot → AI inspects the image
4. Iterate → diff_create to see what changed, fix issues
5. Export  → export_jsx for developer handoff
```

**`render` (JSX) is the primary creation tool** — not individual `create_frame`/`create_text` calls. One JSX call creates an entire component tree:

```jsx
<Frame name="Card" w={320} h="hug" flex="col" gap={16} p={24} bg="#FFF" rounded={16}>
  <Rectangle name="Image" w="fill" h={200} bg="#E5E7EB" rounded={12} />
  <Text name="Title" size={18} weight="bold" color="#111">Card Title</Text>
  <Text name="Description" size={14} color="#6B7280">Lorem ipsum</Text>
</Frame>
```

Individual `set_*` tools are for surgical edits only. JSX renderer ported from figma-use's `packages/cli/src/render/`, lives in `@open-pencil/core` (no DOM deps, works headless too).

**Guardrail/diff tools** for the self-correcting loop:

| Tool | Purpose |
|------|---------|
| `screenshot` | Render viewport/node to PNG → AI inspects visually |
| `snapshot` | Compact text representation of the design tree |
| `diff_create` | Structural diff between two nodes (unified patch) |
| `diff_visual` | Pixel-level diff → image showing differences |
| `diff_show` | Preview property changes before applying |
| `diff_apply` | Apply a diff patch to nodes |

#### Comment pins as AI context

Users pin comments on canvas — AI context annotations, not collaboration comments. When chatting, comments visible in viewport are automatically included in the system prompt with their positions and attached node IDs.

```typescript
// Stored on SceneGraph, not individual nodes (can pin to empty canvas)
interface CommentPin {
  id: string
  text: string
  x: number; y: number
  nodeId?: string
  resolved: boolean
  createdAt: number
}
```

#### Implementation order

1. JSX renderer in `@open-pencil/core` (port from figma-use)
2. Chat panel UI — `ChatPanel.vue`, `useChat()`, message list, tool timeline, `⌘J` toggle
3. API key settings — input UI, Stronghold storage (Tauri) / localStorage (browser)
4. Core tools — render, set_fill, set_layout, set_text, snapshot, get_selection
5. Screenshot + diff tools
6. Comment pin system
7. Full tool set (remaining 118 tools)

#### Validation

| Test | Pass criteria |
|------|---------------|
| Tool coverage | All 118 tools callable via chat and MCP. Automated: call each with valid args → no errors |
| JSX render E2E | Render 10 JSX snippets of varying complexity → all nodes created with correct properties |
| Screenshot loop | AI creates layout → screenshots → detects overlap → fixes → screenshots again → resolved in ≤3 iterations |
| Diff roundtrip | diff_create between two nodes → diff_apply on source → source matches target |
| Chat UX | Send message → tool calls stream in real-time → expandable timeline → final text renders |
| Comment context | Pin 3 comments → send chat message → system prompt includes all 3 with correct positions |
| Error handling | Invalid tool args → clean error in chat, no crash. Network failure → retry/abort UI |

### Phase 6: Polish + Distribution (2 months)

Prototyping, comments, Tauri desktop app, PWA, VS Code extension, documentation, public launch.

**Deliverable:** shippable product.

**Validation:**

| Test | Pass criteria |
|------|---------------|
| Tauri build | Builds on macOS (Apple Silicon + Intel), Windows (x64), Linux (x64). Installer <15MB |
| Tauri CanvasKit | CanvasKit WASM loads correctly in Tauri's WKWebView/WebView2/WebKitGTK. WebGL2 context created. Render test passes |
| Tauri file I/O | Open/save .openpencil via native file dialog. Import .fig via drag-and-drop |
| PWA | Install as PWA → offline capable (IndexedDB) → opens files via File System Access API |
| Prototype preview | Create 3 frames with click transitions → preview mode → click → navigates → back works |
| Comments | Add pin comment → reply → resolve → verify persistence across save/load |
| Performance audit | Lighthouse score >90. First paint <2s. 1000-node document stays at 60fps |
| Cross-browser | Chrome, Safari, Firefox — all E2E tests pass |
| Full Figma compat suite | Run the pixel-perfect test corpus (all tiers). T0: 100% pass. T1: >95% pass. T2: >80% pass |

**Total: ~14 months** (or faster with parallel tracks)

---

## Stack Validation

Every piece needs to work together. Here's the proof-of-concept checklist before committing to the stack:

### PoC 1: CanvasKit + Tauri (Week 1)

**Question:** Does CanvasKit WASM work in Tauri's webview on all platforms?

**Test:**
1. `bun create tauri-app poc-canvaskit` with React template
2. Load `canvaskit-wasm` (7MB) — verify WASM instantiation works
3. Draw 1000 rectangles with random fills → measure FPS
4. Test WebGL2 context on macOS (WKWebView), Windows (WebView2), Linux (WebKitGTK)

**Risk:** Linux WebKitGTK has historically been behind on WebGL2. Mitigation: CanvasKit has a CPU fallback, or we ship with a minimum WebKitGTK version requirement.

**Risk:** WASM file size (7MB). Tauri serves assets via custom protocol (`tauri://`), not HTTP — should be fine but need to verify no loading issues. Mitigation: bundle canvaskit.wasm as a Tauri resource, load via `asset:` protocol.

### PoC 2: Yoga WASM in browser (Week 1)

**Question:** Does `yoga-layout` (v3.2.1, 224KB npm) work alongside CanvasKit WASM?

**Test:**
1. In the same Tauri app from PoC 1, `import { Yoga, Align } from 'yoga-layout'`
2. Create a Yoga tree matching a Figma auto-layout (horizontal, gap:16, padding:20, 3 children with fill_container)
3. Calculate layout → read computed positions → render with CanvasKit at those positions
4. Compare screenshot against the same layout in Figma

**Risk:** Two WASM modules (CanvasKit 7MB + Yoga 45KB) in one page. Should be fine — they use separate WASM memories. Verify no conflicts.

**Risk:** Yoga Grid PR not merged yet. Mitigation: start with Flexbox only (covers 90% of design tool use). Grid can be added later without architecture changes.

### PoC 3: Kiwi codec + .fig parsing (Week 2)

**Question:** Can we extract the figma-use Kiwi code from git history and use it standalone?

**Test:**
1. Extract `multiplayer/schema.ts`, `multiplayer/codec.ts`, `multiplayer/protocol.ts` from git commit `9216dcc^`
2. Package as `@openpencil/kiwi` with `kiwi-schema` dependency
3. Parse 5 real .fig files → decode NodeChange[] → verify node count matches Figma API response
4. Re-encode decoded data → verify byte-level roundtrip (decode → encode → decode → same data)

**Risk:** `kiwi-schema` npm package (by Figma co-founder Evan Wallace) — need to verify it's still maintained and handles all field types correctly. Mitigation: we can vendor and patch if needed.

### PoC 4: Kiwi → SceneGraph → CanvasKit pipeline (Week 2)

**Question:** Can we go from .fig bytes to rendered pixels?

**Test:**
1. Parse .fig → NodeChange[]
2. Build SceneGraph from NodeChange[]
3. For each visible node: map properties to CanvasKit draw calls
4. Render to offscreen CanvasKit surface → export PNG
5. Compare against Figma REST API export of the same file

**Target:** <1% pixel diff on a simple .fig file (frames, rectangles, text, solid fills).

### PoC 5: Yjs + SceneGraph (Week 3)

**Question:** Can Yjs efficiently sync our NodeChange-based scene graph?

**Test:**
1. Represent each node as a `Y.Map` inside a `Y.Map` (flat structure keyed by GUID)
2. Two clients connected via `y-websocket`
3. Client A creates 100 nodes → Client B receives all 100
4. Client A moves node → Client B sees updated position
5. Both clients offline-edit → reconnect → merge without conflicts
6. Measure sync latency (<50ms for single property change over localhost)

**Risk:** Y.Map per node could be memory-heavy for large documents (100K+ nodes). Mitigation: benchmark memory usage. If too high, consider a custom Yjs type or chunked sync.

**Risk:** Yjs has Y.UndoManager — we need to verify it works with our undo model or if we need to keep our own inverse-command stack alongside.

### PoC 6: Tauri + MCP server (Week 3)

**Question:** Can the MCP server run as a sidecar/embedded process in Tauri?

**Test:**
1. Package the MCP server as a Bun binary (or TS compiled with Bun)
2. Launch as Tauri sidecar process
3. MCP client (Claude Desktop or test harness) connects → calls `create_frame` → node appears in editor

**Alternative:** Run MCP as an in-process API (no sidecar). The editor's web code calls MCP tool handlers directly via JS imports. This is simpler and eliminates IPC latency.

**Risk:** Tauri sidecar requires bundling a Bun/Node runtime. Mitigation: compile MCP server to a standalone binary with `bun build --compile`, or run it in-process.

### PoC 7: Full vertical slice (Week 4)

**Question:** Can a user open a .fig file, see it rendered, edit a property, undo, and save?

**Test:**
1. Tauri app with CanvasKit canvas + minimal React UI
2. Import .fig → render scene graph
3. Click to select a rectangle → properties panel shows fill color
4. Change fill → CanvasKit re-renders → undo → original fill restored
5. Save as .openpencil → reopen → identical

This PoC validates the entire stack end-to-end in 4 weeks, before committing to 14 months of development.

---

## CLI & Headless Mode

The editor should be fully controllable by AI agents and usable in CI without a GUI.

### Architecture

Two modes of operation:

**Attached** — CLI connects to a running OpenPencil instance via WebSocket. The app starts a WS server on a configurable port. `eval` runs JS in the app's context with full access to the editor store, scene graph, renderer, and CanvasKit. This is how interactive AI workflows work (create, modify, screenshot, iterate).

**Headless** — CLI loads the engine directly in Bun, no window, no Tauri, no WebGL. For linting, analysis, .fig validation, rendering, CI pipelines. CanvasKit WASM has a CPU software rasterizer (`CanvasKit.MakeSurface(w, h)`) so even PNG export works without a display server.

**Why not a Tauri CLI?** Tauri is a GUI framework — no headless mode. A Bun CLI that imports the engine directly starts instantly and works in CI (Docker, GitHub Actions) without X11/Wayland.

### Monorepo structure

Convert to a Bun workspace monorepo:

```
package.json              — workspace root: { "workspaces": ["packages/*"] }
packages/
  core/                   — engine: scene-graph, layout, codec, types, renderer
    src/
      types.ts            — ← from src/types.ts
      scene-graph.ts      — ← from src/engine/scene-graph.ts
      layout.ts           — ← from src/engine/layout.ts
      renderer.ts         — ← from src/engine/renderer.ts
      fonts.ts            — ← from src/engine/fonts.ts
      color.ts            — ← from src/engine/color.ts
      vector.ts           — ← from src/engine/vector.ts
      snap.ts             — ← from src/engine/snap.ts
      undo.ts             — ← from src/engine/undo.ts
      clipboard.ts        — ← from src/engine/clipboard.ts
      fig-export.ts       — ← from src/engine/fig-export.ts
      canvaskit.ts         — ← from src/engine/canvaskit.ts (+ headless init path)
      constants.ts        — ← rendering/engine constants from src/constants.ts
      kiwi/               — ← from src/kiwi/ (codec, fig-import, fig-file, schema, protocol)
      index.ts            — public API barrel
    package.json          — name: @open-pencil/core, no DOM deps
  cli/                    — CLI: open-pencil command
    src/
      index.ts            — citty main (like figma-use)
      headless.ts         — headless document context (load file → SceneGraph + CanvasKit CPU)
      attached.ts         — WebSocket client for attached mode
      commands/
        eval.ts           — attached: run JS in editor context
        lint.ts           — both: design linter (port from figma-use)
        find.ts           — both: find nodes by name/type/query
        export.ts         — both: PNG/SVG/PDF (headless uses CPU rasterizer)
        node.ts           — both: get/tree node info
        create.ts         — attached: create nodes
        set.ts            — attached: set node properties
        screenshot.ts     — both: render page to PNG
        diff.ts           — headless: visual diff two files
        analyze/
          colors.ts       — both: color palette analysis
          spacing.ts      — both: spacing consistency
        mcp.ts            — both: start MCP server
    package.json          — name: @open-pencil/cli, bin: { "open-pencil": "./src/index.ts" }
  linter/                 — design lint rules (same pattern as figma-use/packages/linter)
    src/
      core/
        types.ts          — LintMessage, LintConfig, LintResult, Rule, RuleContext
        linter.ts         — Linter class: loads rules, walks SceneNode tree, collects messages
        rule.ts           — defineRule() helper
      rules/              — one file per rule
        no-default-names.ts
        pixel-perfect.ts
        consistent-spacing.ts
        consistent-radius.ts
        no-hardcoded-colors.ts
        no-empty-frames.ts
        prefer-auto-layout.ts
        touch-target-size.ts
        color-contrast.ts
      config/
        presets.ts        — recommended, strict, accessibility
      index.ts
    package.json          — name: @open-pencil/linter, depends on @open-pencil/core
  mcp/                    — MCP server for AI agents
    src/
      index.ts            — MCP protocol handler, tool definitions
      tools.ts            — maps MCP tool calls → core/CLI operations
    package.json          — name: @open-pencil/mcp
  app/                    — ← current src/ (Vue + Tauri desktop app)
    src/
      components/         — Vue UI components (unchanged)
      composables/        — Vue composables (unchanged)
      stores/editor.ts    — imports from @open-pencil/core instead of ../engine/
      constants.ts        — UI-only constants (colors kept, but types/engine constants → core)
      demo.ts
      ...
    desktop/              — ← current desktop/ (Tauri Rust)
    package.json          — name: @open-pencil/app, depends on @open-pencil/core
```

### Implementation steps

**Step 1: Bun workspace setup**
- Add `"workspaces"` to root `package.json`
- Create `packages/core/package.json`, `packages/cli/package.json`, etc.
- All packages use `"type": "module"` and TypeScript

**Step 2: Extract `@open-pencil/core`**

The engine files are already clean — zero DOM imports. The work is:
1. Move `src/engine/*.ts` → `packages/core/src/`
2. Move `src/types.ts` → `packages/core/src/types.ts`
3. Move `src/kiwi/` → `packages/core/src/kiwi/`
4. Split `src/constants.ts`: engine constants → `packages/core/src/constants.ts`, UI constants stay in app
5. Remove `@/` alias imports, use relative imports within core
6. `canvaskit.ts` gets a headless init path: `initCanvasKit({ locateFile })` that works without `/canvaskit.wasm` served by Vite
7. `fig-export.ts` IS_TAURI branch stays — but make the non-Tauri fflate path the default, Tauri path optional
8. Create `index.ts` barrel exporting SceneGraph, SceneNode, SkiaRenderer, layout functions, codec, types

After this step: `import { SceneGraph, SkiaRenderer } from '@open-pencil/core'` works from CLI, tests, and app.

**Step 3: Update app to import from core**

Replace all `@/engine/` and `@/types` imports in app code with `@open-pencil/core`:
- `src/stores/editor.ts` — biggest consumer
- `src/components/*.vue` — type imports
- `src/composables/*.ts` — renderer, scene graph types
- `src/demo.ts` — SceneGraph, SceneNode
- Existing tests continue to work (`bun test`)

**Step 4: WebSocket bridge in the app**

Add a WS server to the running app (opt-in, e.g. `--ws-port 9333` or menu toggle):
- Tauri side: use `tauri-plugin-localhost` or spawn from Rust, OR just do it in JS (the webview runs a full JS runtime)
- Simpler: WS server in the Vue app itself using the browser's `WebSocket` API... no, the *app* needs to be the server
- Best approach: tiny WS server in Rust (Tauri command) that forwards messages to the webview via Tauri events
- OR: use the Vite dev server in dev mode, add WS endpoint. In production, Tauri Rust side runs a `tungstenite` WS server

Protocol (JSON-RPC 2.0):
```json
{"jsonrpc":"2.0","id":1,"method":"eval","params":{"code":"editor.graph.getNode('0:1')"}}
{"jsonrpc":"2.0","id":2,"method":"screenshot","params":{"width":1920,"height":1080}}
{"jsonrpc":"2.0","id":3,"method":"createNode","params":{"type":"RECTANGLE","x":0,"y":0,"width":100,"height":100}}
```

The webview handler: receives JSON-RPC, calls editor store methods, returns results. `eval` uses `new Function()` with the store in scope.

**Step 5: Headless document context**

`packages/cli/src/headless.ts`:
```ts
import CanvasKitInit from 'canvaskit-wasm'
import { SceneGraph, SkiaRenderer, readFigFile } from '@open-pencil/core'

export async function loadDocument(filePath: string) {
  const data = await Bun.file(filePath).arrayBuffer()
  const graph = new SceneGraph()
  await readFigFile(new File([data], filePath), graph)
  return graph
}

export async function renderDocument(graph: SceneGraph, opts: { width: number, height: number }) {
  const ck = await CanvasKitInit()
  const surface = ck.MakeSurface(opts.width, opts.height)!
  const renderer = new SkiaRenderer(ck, surface)
  renderer.viewportWidth = opts.width
  renderer.viewportHeight = opts.height
  // ... set zoom to fit, render
  renderer.render(graph, new Set())
  return surface.makeImageSnapshot().encodeToBytes(ck.ImageFormat.PNG, 100)!
}
```

**Step 6: CLI commands**

Use `citty` (same as figma-use) for command framework:
```
open-pencil lint design.fig --preset recommended
open-pencil export design.fig --format png --page "Home"
open-pencil node tree design.fig
open-pencil find design.fig --type RECTANGLE --name "Button*"
open-pencil diff v1.fig v2.fig --output diff.png
open-pencil screenshot --port 9333 --output screen.png
open-pencil eval --port 9333 "editor.select(['0:5'])"
open-pencil mcp --port 9333
```

Headless commands take a file path. Attached commands take `--port`.

**Step 7: Linter**

Port the figma-use linter architecture but adapt types from `FigmaNode` → `SceneNode`:
- `Linter` class walks the `SceneGraph` tree
- Rules get `SceneNode` + `RuleContext` (same pattern: `defineRule`, `context.report()`)
- Start with rules that make sense for our node model: `no-default-names`, `pixel-perfect`, `consistent-spacing`, `no-empty-frames`, `prefer-auto-layout`, `touch-target-size`
- Presets: recommended, strict
- Output: text (with colors) and JSON

**Step 8: MCP server**

Wrap CLI operations as MCP tools. Two modes:
- **Headless MCP**: load a file, expose read-only tools (lint, find, analyze, export)
- **Attached MCP**: connect to running app, expose all tools (create, set, eval, screenshot)

Tool definitions generated from command schemas (like figma-use's `mcp-tools.json`).

### Dependencies

| Package | New deps | Existing (from app) |
|---------|----------|---------------------|
| core | — | canvaskit-wasm, yoga-layout, fflate, fzstd, culori |
| cli | citty, consola | — |
| linter | — | @open-pencil/core |
| mcp | @modelcontextprotocol/sdk | @open-pencil/core, @open-pencil/cli |
| app | — | vue, reka-ui, tailwindcss, @tauri-apps/*, @open-pencil/core |

### Types & shared code

The linter, CLI, MCP, and app all need the same node/document types. These live in `@open-pencil/core` — it's the single source of truth:

```
@open-pencil/core exports:
  types.ts          — GUID, Color, Vector, Matrix, Rect (primitives)
  scene-graph.ts    — SceneNode, SceneGraph, NodeType, Fill, Stroke, Effect,
                      LayoutMode, LayoutSizing, VectorNetwork, etc.
  layout.ts         — computeLayout, computeAllLayouts
  renderer.ts       — SkiaRenderer, RenderOverlays
  color.ts          — parseColor, colorToHex, etc.
  fonts.ts          — loadFont, listFamilies (browser + fs paths)
  vector.ts         — vectorNetworkToPath, encode/decode blobs
  snap.ts           — computeSelectionBounds, computeSnap, SnapGuide
  undo.ts           — UndoManager
  clipboard.ts      — parse/build clipboard HTML
  fig-export.ts     — exportFigFile
  kiwi/             — codec, fig-import, fig-file, schema, protocol
```

The linter doesn't define its own `FigmaNode` — it works directly with `SceneNode` from core. No adapter layer, no duplication.

The JSON-RPC protocol types (for the WS bridge between CLI↔app) live in a shared file within `@open-pencil/core`:

```ts
// core/src/rpc.ts
interface RpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params?: Record<string, unknown>
}

interface RpcResponse {
  jsonrpc: '2.0'
  id: number
  result?: unknown
  error?: { code: number; message: string }
}

type RpcMethod =
  | 'eval'
  | 'screenshot'
  | 'getNode'
  | 'getTree'
  | 'createNode'
  | 'updateNode'
  | 'deleteNode'
  | 'select'
  | 'find'
  | ... 
```

Both the app's WS server and the CLI's WS client import these types from `@open-pencil/core`.

### Tests

Tests live alongside the package they test. Each package has its own `tests/` dir:

```
packages/
  core/
    tests/
      scene-graph.test.ts    — ← existing tests/engine/scene-graph.test.ts (76 tests)
      layout.test.ts         — ← existing tests/engine/layout.test.ts
      fig-import.test.ts     — ← existing tests/engine/fig-import.test.ts
      renderer.test.ts       — NEW: headless render → PNG, compare snapshots
      fig-roundtrip.test.ts  — NEW: import .fig → export .fig → reimport, verify lossless
  linter/
    tests/
      linter.test.ts         — rule execution, preset loading, report format
      rules/                 — one test file per rule (same pattern as figma-use)
  cli/
    tests/
      headless.test.ts       — load .fig file headless, verify scene graph
      commands.test.ts       — CLI command integration tests (invoke via subprocess)
  app/
    tests/
      e2e/                   — ← existing Playwright tests (create-shapes, layers-panel)
      helpers/               — ← existing CanvasHelper
```

All unit tests run with `bun test`. No Playwright, no browser needed. The test commands:

```
bun test                        — all unit tests across all packages
bun test packages/core          — core only
bun test packages/linter        — linter only
bun test packages/cli           — CLI only
bun test --project openpencil   — Playwright e2e (app must be running)
```

New test categories to add:

| Category | Package | What it validates |
|----------|---------|-------------------|
| Headless render | core | `MakeSurface` → render scene → PNG snapshot matches expected |
| Fig roundtrip | core | .fig import → export → reimport produces identical scene graph |
| Linter rules | linter | Each rule produces expected messages on crafted test nodes |
| Linter presets | linter | Preset loads correct rule set, severity overrides work |
| CLI integration | cli | `open-pencil lint test.fig` exits 0/1, outputs expected format |
| CLI headless render | cli | `open-pencil export test.fig --format png` produces valid PNG |
| Visual diff | cli | `open-pencil diff a.fig b.fig` detects pixel differences |

Snapshot tests for rendering: store expected PNGs in `packages/core/tests/snapshots/`. Use pixel-level comparison (allow small tolerance for anti-aliasing across platforms). CanvasKit CPU rasterizer is deterministic on the same platform, so CI snapshots only need per-platform baselines.

### Kiwi decoder performance — investigated

We benchmarked the Rust `kiwi-schema` crate (by Evan Wallace, 1.5M downloads) against our JS decoder:

| File | JS (Bun) | Rust (native) |
|------|----------|---------------|
| material3 (87K nodes, 44.7 MB) | **168 ms** | 595 ms |
| nuxtui (315K nodes, 229 MB) | **785 ms** | 4,215 ms |

**JS is 3.5–5.4x faster.** The Rust crate uses dynamic `Value` enum with `HashMap<&str, Value>` per object — heap allocations for every field of every node. Our JS decoder uses `compileSchema()` which generates specialized decode functions via `new Function()` — the JIT optimizes these into near-native code with zero boxing overhead.

A faster Rust/WASM decoder would require code generation (like protobuf's `prost` with derive macros) to emit typed structs instead of dynamic `Value`. Not worth the effort given our JS decoder already handles 315K nodes in under a second.

**The real bottleneck was O(n²) `getChildren()` in `importNodeChanges`** (scanning all parent entries for each node). Fixed by building a `childrenMap` index upfront → **69x speedup** (37s → 535ms for material3).

### Risks — validated

All three risks have been tested and eliminated:

- **CanvasKit WASM in Bun** ✅ — `MakeSurface(100, 100)` creates a CPU surface, renders shapes, produces valid PNG. Zero issues.
- **Font loading in headless** ✅ — `readFileSync` loads system fonts (e.g. `/System/Library/Fonts/SFNS.ttf`), `FontMgr.FromData()` + `ParagraphBuilder` renders anti-aliased text. For CI (Linux), bundle a default font (Inter or similar).
- **Core extraction complexity** ✅ Low — engine files have zero DOM imports, no circular deps. Only 2 engine files reference `@/constants` (renderer + fig-export). ~30 import statements in app code need `@/engine/` → `@open-pencil/core`. Mechanical move.

---

## Keyboard Shortcuts Reference

Full Figma-compatible shortcut map. Implemented shortcuts marked with ✅.

### Tools (single key, no modifier)

| Key | Tool | Status |
|-----|------|--------|
| V | Move/Select | ✅ |
| K | Scale | |
| H | Hand | ✅ |
| F | Frame | ✅ |
| S | Section / Slice | |
| R | Rectangle | ✅ |
| O | Ellipse | ✅ |
| L | Line | ✅ |
| ⇧L | Arrow | |
| P | Pen | |
| ⇧P | Pencil | |
| T | Text | ✅ |
| C | Comment | |
| I | Eyedropper | |

### File

| Shortcut | Action | Status |
|----------|--------|--------|
| ⌘N | New Window | |
| ⌘O | Open File | ✅ |
| ⌘W | Close Tab | |
| ⌘S | Save | |
| ⇧⌘E | Export… | |

### Edit

| Shortcut | Action | Status |
|----------|--------|--------|
| ⌘Z | Undo | ✅ |
| ⇧⌘Z | Redo | ✅ |
| ⌘X | Cut | |
| ⌘C | Copy | |
| ⌘V | Paste | |
| ⇧⌘V | Paste Over Selection | |
| ⌘D | Duplicate | ✅ |
| ⌫ | Delete | ✅ |
| ⌘A | Select All | ✅ |
| ⇧⌘A | Select Inverse | |
| ⌥⌘C | Copy Properties | |
| ⌥⌘V | Paste Properties | |
| ⌃C | Pick Color (Eyedropper) | |

### View

| Shortcut | Action | Status |
|----------|--------|--------|
| ⌘' | Pixel Grid | |
| ⌃G | Layout Guides | |
| ⇧R | Rulers | |
| ⌘\ | Show/Hide UI | |
| ⌘= | Zoom In | ✅ |
| ⌘- | Zoom Out | ✅ |
| ⌘0 | Zoom to 100% | ✅ |
| ⌘1 | Zoom to Fit | |
| ⌘2 | Zoom to Selection | |
| N / ⇧N | Next/Previous Frame | |

### Object

| Shortcut | Action | Status |
|----------|--------|--------|
| ⌥⌘G | Frame Selection | |
| ⌘G | Group Selection | |
| ⇧⌘G | Ungroup | |
| ⇧A | Add Auto Layout | |
| ⌥⌘K | Create Component | |
| ⌥⌘B | Detach Instance | |
| ⌘] | Bring Forward | |
| ⌥⌘] | Bring to Front | |
| ⌘[ | Send Backward | |
| ⌥⌘[ | Send to Back | |
| ⇧H | Flip Horizontal | |
| ⇧V | Flip Vertical | |
| ⌘E | Flatten | |
| ⇧⌘H | Show/Hide Selection | |
| ⇧⌘L | Lock/Unlock Selection | |
| ⌥/ | Remove Fill | |
| ⇧X | Swap Fill and Stroke | |

### Text

| Shortcut | Action | Status |
|----------|--------|--------|
| ⌘B | Bold | |
| ⌘I | Italic | |
| ⌘U | Underline | |
| ⇧⌘X | Strikethrough | |
| ⇧⌘U | Create Link | |

### Arrange

| Shortcut | Action | Status |
|----------|--------|--------|
| ⌥A | Align Left | |
| ⌥H | Align Horizontal Centers | |
| ⌥D | Align Right | |
| ⌥W | Align Top | |
| ⌥V | Align Vertical Centers | |
| ⌥S | Align Bottom | |
| ⌥⇧H | Distribute Horizontal Spacing | |
| ⌥⇧V | Distribute Vertical Spacing | |

### Canvas Interaction

| Input | Action | Status |
|-------|--------|--------|
| Click | Select node | ✅ |
| Shift+Click | Add/remove from selection | ✅ |
| Alt+Drag | Duplicate and move | ✅ |
| Shift+Drag (draw) | Constrain to square/circle | ✅ |
| Shift+Drag (resize) | Maintain aspect ratio | ✅ |
| Shift+Drag (rotate) | Snap to 15° | ✅ |
| Middle mouse drag | Pan | ✅ |
| Scroll | Pan | ✅ |
| Ctrl+Scroll / Pinch | Zoom | ✅ |
| Double-click text | Edit text inline | ✅ |
| Drag onto frame | Reparent into frame | ✅ |
| Escape | Deselect / Cancel | ✅ |

---

*Created: 2026-02-26*
