# Architektur

## Systemübersicht

```
┌──────────────────────────────────────────────────────────────────┐
│                         Tauri v2 Shell                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                     Editor (Web)                           │  │
│  │                                                            │  │
│  │  Vue 3 UI                   Skia CanvasKit (WASM, 7MB)    │  │
│  │  - Werkzeugleiste           - Vektordarstellung            │  │
│  │  - Panels                   - Textgestaltung               │  │
│  │  - Eigenschaften            - Bildverarbeitung             │  │
│  │  - Ebenen                   - Effekte (Unschärfe, Schatten)│  │
│  │  - Farbauswahl              - Export (PNG, SVG, PDF)       │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │                  Core Engine (TS)                     │ │  │
│  │  │  SceneGraph ─── Layout (Yoga) ─── Selection          │ │  │
│  │  │      │                                  │             │ │  │
│  │  │  Undo/Redo ─── Constraints ─── Hit Testing           │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │              Dateiformatschicht                        │ │  │
│  │  │  .fig Import/Export ── Kiwi-Codec ── .svg (geplant)  │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  MCP-Server (29+ Werkzeuge)       Kollaboration (P2P, Yjs CRDT) │
└──────────────────────────────────────────────────────────────────┘
```

## Editor-Layout

Die Oberfläche folgt Figmas UI3-Layout — Werkzeugleiste unten, Navigation links, Eigenschaften rechts:

- **Navigationspanel (links)** — Ebenenbaum, Seitenpanel, Asset-Bibliothek (geplant)
- **Canvas (Mitte)** — Unendlicher Canvas mit CanvasKit-Rendering, Zoom/Pan
- **Eigenschaftspanel (rechts)** — Kontextsensitive Abschnitte: Darstellung, Füllung, Kontur, Typografie, Layout, Position
- **Werkzeugleiste (unten)** — Werkzeugauswahl: Auswahl, Frame, Sektion, Rechteck, Ellipse, Linie, Text, Stift, Hand

## Komponenten

### Rendering (CanvasKit WASM)

Dieselbe Rendering-Engine wie Figma. CanvasKit bietet GPU-beschleunigte 2D-Zeichnung mit Vektorformen, Textgestaltung, Effekten und Export.

Das 7 MB große WASM-Binary wird beim Start geladen und erstellt eine GPU-Oberfläche auf dem HTML-Canvas.

### Szenengraph

Flache `Map<string, Node>` mit GUID-Strings als Schlüssel. Baumstruktur über `parentIndex`-Referenzen. Bietet O(1)-Lookup, effiziente Traversierung und Hit-Testing.

Siehe [Szenengraph-Referenz](/reference/scene-graph) für Interna.

### Layout-Engine (Yoga WASM)

Metas Yoga bietet CSS-Flexbox-Layout-Berechnung. Ein dünner Adapter mappt Figma-Eigenschaftsnamen auf Yoga-Äquivalente:

| Figma-Eigenschaft | Yoga-Äquivalent |
|---|---|
| `stackMode: HORIZONTAL` | `flexDirection: row` |
| `stackMode: VERTICAL` | `flexDirection: column` |
| `stackSpacing` | `gap` |
| `stackPadding` | `padding` |
| `stackJustify` | `justifyContent` |
| `stackChildPrimaryGrow` | `flexGrow` |

### Dateiformat (Kiwi-Binär)

Verwendet Figmas bewährten Kiwi-Binär-Codec mit 194 Nachrichten-/Enum-/Strukturdefinitionen. Siehe [Dateiformat-Referenz](/reference/file-format) für Details.

### Rückgängig/Wiederherstellen

Inverse-Command-Muster. Vor jeder Änderung werden betroffene Felder als Snapshot gespeichert. Der Snapshot wird zur inversen Operation. Batching gruppiert schnelle Änderungen (wie Ziehen) zu einzelnen Undo-Einträgen.

### Zwischenablage

Figma-kompatible bidirektionale Zwischenablage. Kodiert/dekodiert Kiwi-Binär (gleiches Format wie .fig-Dateien) über native Browser-Kopier/Einfüge-Events.
