# Comparación con Penpot

| Metric | Open Pencil | Penpot |
|--------|-------------|--------|
| Total LOC | **~26,000** | **~299,000** |
| Source files | 125 | ~2,900 |
| Languages | TypeScript, Vue | Clojure, ClojureScript, Rust, JS, SQL, SCSS |
| LOC ratio | **1×** | **~11×** |
| Rendering | Skia CanvasKit (GPU, WASM) | Skia Rust/WASM (render-wasm v1) |
| Layout | Yoga WASM (CSS flexbox) | Custom CLJS engine |
| File format | Figma Kiwi binary (.fig) | Custom SVG + metadata |
| Desktop | Tauri v2 (~5 MB) | No native client |
| Backend | None (P2P) | Clojure + PostgreSQL + Redis |
| Collaboration | P2P (Trystero + Yjs CRDT) | Client-server |
| AI tools | 29 tools + MCP server | Plugin system |
| CLI | ✅ 12 commands | ❌ |

[Full details in English](/guide/comparison)
