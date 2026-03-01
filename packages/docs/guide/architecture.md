# Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         Tauri v2 Shell                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                     Editor (Web)                           │  │
│  │                                                            │  │
│  │  Vue 3 UI                   Skia CanvasKit (WASM, 7MB)    │  │
│  │  - Toolbar                  - Vector rendering             │  │
│  │  - Panels                   - Text shaping                 │  │
│  │  - Properties               - Image processing             │  │
│  │  - Layers                   - Effects (blur, shadow)       │  │
│  │  - Color Picker             - Export (PNG, SVG, PDF)       │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │                  Core Engine (TS)                     │ │  │
│  │  │  SceneGraph ─── Layout (Yoga) ─── Selection          │ │  │
│  │  │      │                                  │             │ │  │
│  │  │  Undo/Redo ─── Constraints ─── Hit Testing           │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │              File Format Layer                        │ │  │
│  │  │  .fig import/export ── Kiwi codec ── .svg (planned)  │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  MCP Server (planned, 117 tools)    Collaboration (planned, CRDT) │
└──────────────────────────────────────────────────────────────────┘
```

## Editor Layout

The UI follows Figma's UI3 layout — toolbar at the bottom, navigation on the left, properties on the right:

- **Navigation panel (left)** — Layers tree, pages panel, asset library (planned)
- **Canvas (center)** — Infinite canvas with CanvasKit rendering, zoom/pan
- **Properties panel (right)** — Context-sensitive sections: Appearance, Fill, Stroke, Typography, Layout, Position
- **Toolbar (bottom)** — Tool selection: Select, Frame, Section, Rectangle, Ellipse, Line, Text, Pen, Hand

## Components

### Rendering (CanvasKit WASM)

The same rendering engine as Figma. CanvasKit provides GPU-accelerated 2D drawing with:
- Vector shapes (rect, ellipse, path, line, star, polygon)
- Text shaping via Paragraph API
- Effects (shadows, blurs, blend modes)
- Export (PNG, SVG, PDF)

The 7MB WASM binary loads at startup and creates a GPU surface on the HTML canvas.

### Scene Graph

Flat `Map<string, Node>` keyed by GUID strings. Tree structure via `parentIndex` references. Provides O(1) lookup, efficient traversal, hit testing, and rectangular area queries for marquee selection.

See [Scene Graph Reference](/reference/scene-graph) for internals.

### Layout Engine (Yoga WASM)

Meta's Yoga provides CSS flexbox layout computation. A thin adapter maps Figma property names to Yoga equivalents:

| Figma Property | Yoga Equivalent |
|---|---|
| `stackMode: HORIZONTAL` | `flexDirection: row` |
| `stackMode: VERTICAL` | `flexDirection: column` |
| `stackSpacing` | `gap` |
| `stackPadding` | `padding` |
| `stackJustify` | `justifyContent` |
| `stackChildPrimaryGrow` | `flexGrow` |

### File Format (Kiwi Binary)

Reuses Figma's proven Kiwi binary codec with 194 message/enum/struct definitions. The `.fig` import pipeline: parse header → Zstd decompress → Kiwi decode → NodeChange[] → scene graph. The export pipeline reverses the process: scene graph → NodeChange[] → Kiwi encode → Zstd compress → ZIP with thumbnail.

See [File Format Reference](/reference/file-format) for details.

### Undo/Redo

Inverse-command pattern. Before applying any change, affected fields are snapshotted. The snapshot becomes the inverse operation. Batching groups rapid changes (like drag) into single undo entries.

### Clipboard

Figma-compatible bidirectional clipboard. Encodes/decodes fig-kiwi binary using native browser copy/paste events (synchronous, not async Clipboard API).
