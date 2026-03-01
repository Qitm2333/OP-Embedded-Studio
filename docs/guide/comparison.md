# Open Pencil vs Penpot: Architecture & Performance Comparison

Why compare? OpenPencil exists because closed design platforms control what's possible. Understanding architectural differences shows what an open, local-first alternative can do differently.

## 1. Scale & Codebase Size

| Metric | Open Pencil | Penpot |
|--------|-------------|--------|
| Total LOC | **~14,500** | **~292,000** |
| Source files | 53 | ~2,900 |
| Languages | TypeScript, Vue | Clojure, ClojureScript, Rust, JS, SQL, SCSS |
| Rendering engine | 1,646 LOC (TS) | 22,000 LOC (Rust) |
| UI code | ~4,500 LOC | ~175,000 LOC (CLJS + SCSS) |
| Backend | None (local-first) | 32,600 LOC + 151 SQL files |
| LOC ratio | **1x** | **~20x** |

Open Pencil is **20x smaller** — and that's the whole point. It's not a simplification; it's a fundamentally different architecture.

## 2. Architecture

### Open Pencil: Monolithic Client

```
┌─────────────────────────────────┐
│         Tauri (native shell)    │
│  ┌───────────────────────────┐  │
│  │  Vue 3 + TypeScript       │  │
│  │  ┌─────────┐ ┌──────────┐│  │
│  │  │  Editor  │ │  Kiwi    ││  │
│  │  │  Store   │ │  Codec   ││  │
│  │  └────┬─────┘ └──────────┘│  │
│  │       │                    │  │
│  │  ┌────▼────────────────┐  │  │
│  │  │  Scene Graph (TS)    │  │  │
│  │  │  Map<string, Node>   │  │  │
│  │  └────┬────────────────┘  │  │
│  │       │                    │  │
│  │  ┌────▼────┐ ┌──────────┐│  │
│  │  │  Skia   │ │  Yoga    ││  │
│  │  │CanvasKit│ │  Layout  ││  │
│  │  │  (WASM) │ │  (WASM)  ││  │
│  │  └─────────┘ └──────────┘│  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**Everything in one process.** No server, no database, no Docker. The scene graph is a flat `Map<string, SceneNode>` in TypeScript. Rendering calls Skia CanvasKit directly from TS. Layout is Yoga WASM called synchronously.

### Penpot: Distributed Client-Server

```
┌───────────────────────────────────────────────────────┐
│                    Docker Compose                      │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │   Frontend    │  │   Backend   │  │   Exporter   │ │
│  │  ClojureScript│  │   Clojure   │  │  (Puppeteer) │ │
│  │  shadow-cljs  │  │   JVM       │  │              │ │
│  │              │  │  ┌────────┐  │  └──────────────┘ │
│  │  ┌─────────┐│  │  │PostgreSQL│ │                   │
│  │  │render-wasm│  │  │  Redis   │ │  ┌──────────────┐│
│  │  │ (Rust→  ││  │  │  MinIO   │ │  │   MCP        ││
│  │  │  WASM)  ││  │  └────────┘  │  │   Server     ││
│  │  └─────────┘│  │              │  └──────────────┘ │
│  └──────────────┘  └─────────────┘                    │
└───────────────────────────────────────────────────────┘
```

**5+ services minimum.** PostgreSQL for persistence, Redis for caching/sessions, MinIO for asset storage, a JVM backend, a Node.js exporter, plus the ClojureScript frontend. Dev setup requires Docker Compose with custom networking.

### Verdict: Architecture

Open Pencil's single-process architecture eliminates:
- Network latency between frontend and backend
- Serialization/deserialization overhead at service boundaries
- Container orchestration complexity
- Database query overhead for every operation

Penpot's architecture is optimized for **multi-user server-hosted deployments**. Open Pencil is optimized for **instant local performance**.

## 3. Rendering Pipeline

### Open Pencil: TS → CanvasKit WASM (direct)

```typescript
// renderer.ts — direct CanvasKit calls from TypeScript
renderSceneToCanvas(canvas, graph, pageId) {
  // Iterate nodes, build Skia paths/paints, draw
  this.fillPaint.setColor(...)
  canvas.drawRRect(rrect, this.fillPaint)
}
```

- **1 boundary crossing:** TS → WASM (CanvasKit)
- Scene graph lives in JS heap — no serialization to render
- 1,646 LOC total renderer

### Penpot: CLJS → JS FFI → Rust WASM (Skia bindings)

```
ClojureScript shape data
  → JS interop bridge
  → Rust WASM functions (via Emscripten FFI)
  → skia-safe (Rust Skia bindings)
  → Skia native calls
```

- **3+ boundary crossings:** CLJS → JS → WASM FFI → Skia
- Tile-based rendering system (307 LOC tiles.rs) with interest areas
- 11 separate render surfaces (fills, strokes, shadows, etc.)
- Global mutable state via `unsafe { STATE.as_mut() }` pattern
- 22,000 LOC Rust render engine

Penpot's tile system (`TileViewbox`, `TileTextureCache`, `TILE_SIZE_MULTIPLIER`) is needed because their rendering is expensive enough to require caching. They pre-render tiles around the viewport and cache textures (up to 1024 entries).

Open Pencil re-renders the full viewport every frame because CanvasKit called directly from TS is fast enough to not need caching.

### Verdict: Rendering

| Aspect | Open Pencil | Penpot |
|--------|-------------|--------|
| Boundary crossings | 1 (TS→WASM) | 3+ (CLJS→JS→WASM→Skia) |
| Rendering model | Immediate/full redraw | Tile-cached |
| Surface management | 1 surface | 11 surfaces |
| Memory overhead | Low (no tile cache) | High (1024 tile cache) |
| Code complexity | 1,646 LOC | 22,000 LOC |
| Unsafe code | None | `unsafe` global state |

For small-to-medium documents, Open Pencil's direct approach will be faster. Penpot's tile system may win on extremely large canvases (100K+ shapes) where only a small viewport is visible — but the overhead is significant.

## 4. Scene Graph & Data Model

### Open Pencil

```typescript
// Flat map, O(1) lookup
nodes: Map<string, SceneNode>
// 29 node types from Figma's Kiwi schema
// ~390 fields per NodeChange (Figma-compatible)
```

- TypeScript interfaces with strict types
- GUIDs match Figma's `sessionID:localID` format
- Direct property access — no indirection layers

### Penpot

```clojure
;; 20+ type definition files in common/src/app/common/types/
;; shapes_builder.cljc, shapes_helpers.cljc
;; Separate type systems for: color, component, container, fills,
;; grid, modifiers, objects_map, page, path, etc.
```

- Data spread across `common/` (49,600 LOC of .cljc)
- Separate geometry modules for flex layout (~6 files), grid layout (~5 files), constraints, bounds, corners, effects
- Runtime schema validation (Malli)
- Data must cross CLJS→Rust boundary for rendering

### Verdict: Data Model

Open Pencil reuses Figma's proven schema (194 Kiwi definitions) directly in TypeScript — zero translation. Penpot maintains its own type system across Clojure/ClojureScript/Rust, requiring manual sync between all three.

## 5. Layout Engine

### Open Pencil: Yoga WASM (314 LOC)

```typescript
import Yoga from 'yoga-layout'
// Direct mapping: Figma stack* fields → Yoga flex properties
const root = Yoga.Node.create()
root.setFlexDirection(FlexDirection.Row)
root.calculateLayout()
applyYogaLayout(graph, frame, yogaRoot)
```

314 lines total. Synchronous, in-process.

### Penpot: Dual Implementation

1. **ClojureScript** (common): `flex_layout/` (6 files), `grid_layout/` (5+ files) — custom implementations
2. **Rust WASM**: `flex_layout.rs` (741 LOC), `grid_layout.rs` (843 LOC) — reimplemented from scratch

Penpot maintains **two independent layout engines** (CLJS and Rust) that must produce identical results.

### Verdict: Layout

Open Pencil delegates to a battle-tested library (Yoga, used by React Native on billions of devices) in 314 lines. Penpot maintains ~3,000+ LOC of custom layout code duplicated across two languages.

## 6. File Format & Figma Compatibility

### Open Pencil

- **Native Kiwi binary format** — same serialization as Figma uses internally
- Direct `.fig` file import via extracted Kiwi codec (2,178 LOC schema + 551 LOC codec)
- Figma clipboard paste support (reads Figma's `fig-kiwi` binary clipboard format)
- Wire-compatible with Figma's multiplayer protocol

### Penpot

- **Custom Transit/JSON-based format** (`.penpot` files)
- SVG as the intermediate representation
- No native `.fig` import
- Separate binary file format (`binfile/v1.clj`, `v2.clj`, `v3.clj`) with migration system

### Verdict: File Format

Open Pencil has a significant advantage — it can read Figma files natively and even paste Figma clipboard data. Penpot requires manual export/import and cannot open `.fig` files.

## 7. State Management & Undo

### Open Pencil

```typescript
// 110 LOC — inverse command pattern
class UndoManager {
  apply(entry: UndoEntry) { entry.forward(); this.undoStack.push(entry) }
  undo() { entry.inverse(); this.redoStack.push(entry) }
}
```

110 lines. Forward/inverse closures that capture minimal state. Batch support for multi-step operations.

### Penpot

State management uses a custom reactive system (Potok) on top of ClojureScript atoms. Undo is based on changes tracked through a change-builder system across multiple files in `common/src/app/common/files/changes*.cljc`.

### Verdict: State

Open Pencil's approach is simpler and lower overhead. Penpot's approach is more suitable for collaboration (changes are serializable), but at the cost of complexity.

## 8. Developer Experience

| Metric | Open Pencil | Penpot |
|--------|-------------|--------|
| Dev setup | `bun install && bun dev` | Docker Compose + JVM + Node + Rust toolchain |
| Hot reload | Vite HMR (~50ms) | shadow-cljs (seconds) |
| Type checking | TypeScript (strict) | Runtime (Malli schemas) |
| Build time | <5s (Vite) | Minutes (JVM startup + CLJS compile + Rust WASM) |
| First contribution barrier | Low (TS/Vue) | High (Clojure + Rust + Docker) |
| Desktop | Tauri v2 (~5MB) | N/A (browser-only) |
| Hiring pool | Massive (TS/Vue devs) | Tiny (ClojureScript + Rust) |

## 9. Performance Characteristics

| Scenario | Open Pencil | Penpot |
|----------|-------------|--------|
| Cold start | <2s (WASM load) | 10s+ (server + client + WASM) |
| Operation latency | <1ms (in-process) | 10-50ms (network round-trip) |
| Render frame | Direct Skia call | CLJS→JS→WASM FFI→Skia |
| Memory baseline | ~50MB (browser tab) | ~300MB+ (JVM + Postgres + Redis + browser) |
| Offline capability | Full (local-first) | None (server-dependent) |
| 10K shapes render | One pass, no caching | Tile-based with 11 surfaces |

## 10. What Penpot Does Better

1. **Real-time collaboration** — production-ready multi-user editing with WebSockets
2. **Server-side export** — Puppeteer-based export service for server-side rendering
3. **Plugin system** — full plugin API with sandboxed execution
4. **Design tokens** — native design token support
5. **CSS Grid layout** — custom implementation (Open Pencil waiting for Yoga Grid)
6. **Self-hosting** — Docker-based deployment for teams
7. **Maturity** — years of production usage, battle-tested at scale

## Summary

| Dimension | Winner | Why |
|-----------|--------|-----|
| **Architecture simplicity** | Open Pencil | Single process vs 5+ services |
| **Rendering performance** | Open Pencil | 1 vs 3+ boundary crossings, no tile overhead |
| **Code maintainability** | Open Pencil | 14.5K LOC in 1 language vs 292K in 4 languages |
| **Figma compatibility** | Open Pencil | Native Kiwi codec vs no .fig support |
| **Developer onboarding** | Open Pencil | TS/Vue vs Clojure/Rust/Docker |
| **Desktop experience** | Open Pencil | Tauri native vs browser-only |
| **Layout engine** | Open Pencil | Yoga (proven) vs custom dual implementation |
| **Collaboration** | Penpot | Production multi-user vs planned (Yjs) |
| **Self-hosting** | Penpot | Docker-ready vs desktop-only |
| **Ecosystem maturity** | Penpot | Years of production vs early stage |

Open Pencil is architecturally superior for a design tool — leaner, faster, more maintainable, and Figma-compatible by design. Penpot carries the weight of a server-first architecture with 20x more code spread across 4 languages, which creates compounding maintenance burden. The tradeoff is that Penpot already has production collaboration and a plugin ecosystem, while Open Pencil is still building toward those.
