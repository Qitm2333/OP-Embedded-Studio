# Stack technologiczny

| Layer | Technology | Why |
|-------|-----------|-----|
| **Rendering** | Skia CanvasKit WASM | GPU-accelerated, same as Figma |
| **UI** | Vue 3 + VueUse | Reactive, TypeScript |
| **Components** | Reka UI | Headless, accessible |
| **Styling** | Tailwind CSS 4 | Utility-first |
| **Layout** | Yoga WASM | CSS flexbox (Meta) |
| **File Format** | Kiwi binary + Zstd | Figma .fig compatible |
| **Desktop** | Tauri v2 | ~5 MB (vs Electron ~100 MB) |
| **Build** | Vite 7 | Fast HMR |
| **Testing** | Playwright + bun:test | E2E + unit |
| **Linting** | oxlint | Rust-based |
| **Type Checking** | typescript-go (tsgo) | Native Go |

[Full details in English](/guide/tech-stack)
