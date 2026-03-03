# Architettura

## Panoramica del sistema

```
┌──────────────────────────────────────────────────────────────────┐
│                         Tauri v2 Shell                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Vue 3 UI              Skia CanvasKit (WASM, 7MB)         │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │  Core Engine (TS): SceneGraph, Layout, Selection     │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │  .fig import/export ── Kiwi codec                    │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
│  MCP Server (29+ tools)          P2P Collaboration (Yjs CRDT)    │
└──────────────────────────────────────────────────────────────────┘
```

UI segue il layout UI3 di Figma.

Rendering: CanvasKit WASM — GPU, Skia.

Grafo della scena: `Map<string, Node>` — O(1) lookup, hit testing.

Formato file: Kiwi binary codec — 194 definitions. [File Format](/reference/file-format).

Annulla/Ripristina: Inverse-command pattern.

Appunti: Figma-compatible, Kiwi binary.

[Full details in English](/guide/architecture)
