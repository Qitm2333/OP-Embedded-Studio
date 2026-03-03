# Tech-Stack

## Kerntechnologien

| Schicht | Technologie | Warum |
|---------|-----------|-------|
| **Rendering** | Skia CanvasKit WASM | Dieselbe Engine wie Figma — bewährte Leistung, GPU-beschleunigt, pixelgenau |
| **UI-Framework** | Vue 3 + VueUse | Reaktive Composition API, hervorragende TypeScript-Unterstützung |
| **Komponenten** | Reka UI | Headless, barrierefreie UI-Primitive (Tree, Slider usw.) |
| **Styling** | Tailwind CSS 4 | Utility-first, schnelle Iteration, dunkles Theme |
| **Layout** | Yoga WASM | CSS-Flexbox-Engine von Meta, kampferprobt in React Native |
| **Dateiformat** | Kiwi-Binär + Zstd | Figmas eigenes Format — kompakt, schnelles Parsen, .fig-kompatibel |
| **Farbe** | culori | Farbraum-Konvertierungen (HSV, RGB, Hex) |
| **Desktop** | Tauri v2 | ~5 MB native App (vs. Electrons ~100 MB), Rust-Backend |
| **Build** | Vite 7 | Schnelles HMR, native ES-Module |
| **Testing** | Playwright + bun:test | Visuelle Regression (E2E) + schnelle Unit-Tests |
| **Linting** | oxlint | Rust-basiert, um Größenordnungen schneller als ESLint |
| **Formatierung** | oxfmt | Rust-basierter Formatierer |
| **Typprüfung** | typescript-go (tsgo) | Native Go-Implementierung des TypeScript-Typprüfers |

## Warum nicht...

### Warum kein SVG-Rendering?

SVG ist langsam für komplexe Dokumente. Jeder Knoten ist ein DOM-Element — 10.000 Knoten bedeuten 10.000 DOM-Knoten. CanvasKit zeichnet alles auf eine einzige GPU-Oberfläche.

### Warum nicht Electron (wie Figma Desktop)?

Tauri v2 nutzt den System-Webview (~5 MB) statt Chromium zu bündeln (~100 MB).

### Warum nicht React?

Das Projekt migrierte früh von React zu Vue 3. Vues Reaktivitätssystem und VueUse-Composables erwiesen sich als ergonomischer.

### Warum keine eigene Layout-Engine?

Yoga wird von Meta gepflegt, ist auf Milliarden von React-Native-Geräten getestet und implementiert die CSS-Flexbox-Spezifikation.
