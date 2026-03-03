# Architecture

## Vue d'ensemble

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

L'interface suit le layout UI3 de Figma.

Rendu : CanvasKit WASM — GPU, Skia.

Graphe de scène : `Map<string, Node>` — O(1) lookup, hit testing.

Format de fichier : Kiwi binary codec — 194 definitions. [File Format](/reference/file-format).

Annuler/Rétablir : Inverse-command pattern.

Presse-papiers : Figma-compatible, Kiwi binary.

[Full details in English](/guide/architecture)
