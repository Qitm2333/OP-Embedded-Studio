# Arquitectura

## Vista general del sistema

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

La interfaz sigue el layout UI3 de Figma.

Renderizado: CanvasKit WASM — GPU, Skia.

Grafo de escena: `Map<string, Node>` — O(1) lookup, hit testing.

Formato de archivo: Kiwi binary codec — 194 definitions. [File Format](/reference/file-format).

Deshacer/Rehacer: Inverse-command pattern.

Portapapeles: Figma-compatible, Kiwi binary.

[Full details in English](/guide/architecture)
