# Architektura

## Przegląd systemu

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

Interfejs podąża za layoutem UI3 Figmy.

Renderowanie: CanvasKit WASM — GPU, Skia.

Graf sceny: `Map<string, Node>` — O(1) lookup, hit testing.

Format pliku: Kiwi binary codec — 194 definitions. [File Format](/reference/file-format).

Cofnij/Ponów: Inverse-command pattern.

Schowek: Figma-compatible, Kiwi binary.

[Full details in English](/guide/architecture)
