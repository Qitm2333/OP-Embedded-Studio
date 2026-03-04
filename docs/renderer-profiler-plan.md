# Renderer Profiler — Design Plan

Production-grade instrumentation for OpenPencil's CanvasKit/Skia renderer, inspired by game engine profiling tools (Unreal Insights, Unity Frame Timing Manager) and browser render engine internals (Chrome Compositor, WebKit/Skia tracing).

## What Skia gives us

### 1. Profiling build of CanvasKit

`canvaskit-wasm` ships three bundles:
- **default** — stripped WASM names
- **full** — includes Skottie etc.
- **profiling** — same as full but with **full internal function names** preserved in WASM

```ts
import InitCanvasKit from 'canvaskit-wasm/profiling'
```

This means Chrome DevTools Performance panel flame charts will show real Skia C++ function names (`GrDrawingManager::internalFlush`, `SkCanvas::drawRect`, etc.) instead of mangled `$func123`. We should use this build behind a `?profiling` URL param or a dev-mode toggle.

### 2. SkPicture recording & replay

Skia's `SkPictureRecorder` records draw commands into an immutable `SkPicture`. We already use this for caching (`recordScenePicture`). Key profiling insight from Skia's own benchmark tool:

> `CanvasKit.flush()` returns after it has sent all instructions to the GPU, but we don't know the GPU is done until the **next frame is requested**. Thus, we need to keep track of time **between frames** to accurately calculate draw time.

- `drawPicture + flush` duration tells us CPU-side WASM/JS time
- `total_frame_ms` (time between rAFs) tells us the real GPU-inclusive cost
- If `total_frame_ms ≈ with_flush_ms` → CPU-bound
- If `total_frame_ms >> with_flush_ms` → GPU-bound

### 3. Skia Debugger (external tool)

Skia has an online debugger at https://debugger.skia.org that can load `.skp` files and show:
- Draw command playback
- GPU op bounds visualization
- Overdraw visualization
- Clip/matrix state at any step
- GPU operation batching (colored op IDs)

We could add an "Export .skp" debug feature to save the current `scenePicture` for analysis.

### 4. EXT_disjoint_timer_query (GPU timing)

The `EXT_disjoint_timer_query_webgl2` WebGL extension provides **actual GPU-side timing** in nanoseconds. Figma built [figma/webgl-profiler](https://github.com/figma/webgl-profiler) on top of this exact extension.

**Limitations:**
- Only works in Desktop Chrome ≥ 70
- `TIMESTAMP_EXT` was removed for security; only `TIME_ELAPSED_EXT` (begin/end query) works
- Results are asynchronous (available next frame or later)
- Non-draw commands often report 0ns (but totals are accurate)
- Inconsistent on non-Apple-Silicon Intel GPUs

**Usage pattern:**
```ts
const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')
const query = gl.createQuery()
gl.beginQuery(ext.TIME_ELAPSED_EXT, query)
// ... draw calls ...
gl.endQuery(ext.TIME_ELAPSED_EXT)
// next frame: poll gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)
```

### 5. Chrome Performance Panel extensibility

Chrome now supports custom tracks via `performance.mark`/`performance.measure` with `detail.devtools` metadata, and the lower-overhead `console.timeStamp` API:

```ts
performance.measure("Scene Render", {
  start: startMark,
  detail: {
    devtools: {
      dataType: "track-entry",
      track: "OpenPencil Renderer",
      trackGroup: "OpenPencil",
      color: "primary",
      properties: [["Nodes", "142"], ["Cached", "true"]],
      tooltipText: "Full scene render with SkPicture cache hit"
    }
  }
})
```

This shows up as a dedicated "OpenPencil Renderer" track in the DevTools Performance panel alongside browser internals. Extremely powerful for production debugging.

---

## Architecture

### Layers of profiling (from light to heavy)

| Layer | Overhead | Always-on | What it measures |
|-------|----------|-----------|-----------------|
| **Frame Stats HUD** | ~0.1ms | Optional toggle | FPS, frame time, CPU/GPU split, node count, cache hits |
| **User Timing marks** | ~0.01ms each | Dev builds | Phase timings visible in DevTools Performance panel |
| **GPU Timer Queries** | ~0.2ms setup | On demand | Actual GPU execution time per frame (async readback) |
| **Detailed profiler** | ~1-3ms | Manual trigger | Per-node timings, draw call counts, overdraw heatmap |

### 1. Frame Stats HUD (always-available, minimal overhead)

An in-canvas overlay rendered by SkiaRenderer itself, togglable via keyboard shortcut (Shift+P or similar). Modeled after game engine stat overlays.

**Metrics displayed:**
```
 FPS: 60 (16.7ms)       ← smoothed rAF delta
 CPU: 4.2ms             ← JS/WASM time (start of render → after flush)
 GPU: 8.1ms             ← GPU time (async, from EXT_disjoint_timer_query or inferred)
 ─────────────────
 Nodes: 342 (47 culled)  ← total vs viewport-culled count
 Draw calls: 128         ← WebGL draw call count
 Cache: SkPicture HIT    ← scene picture reuse status
 Textures: 12 (48MB)     ← image cache stats
 WASM heap: 64MB         ← CanvasKit memory
```

**Frame time graph** — rolling 120-frame history bar chart (like Unreal's `stat unit`), color-coded:
- Green: within budget (16.7ms for 60fps)
- Yellow: over budget but < 2× (16.7–33.3ms)
- Red: severe (> 33.3ms)

The graph draws CPU bars from bottom and GPU bars from top, making CPU/GPU overlap visible at a glance (exactly how Unity Frame Timing Manager visualizes it).

### 2. Phase instrumentation (User Timing API)

Instrument the `render()` method with `performance.mark`/`performance.measure` using the Chrome DevTools extensibility API to create a custom "OpenPencil" track group:

**Phases to instrument:**

| Phase | What | Where in code |
|-------|------|---------------|
| `frame` | Total rAF-to-rAF | `useCanvas.ts` rAF callback |
| `render:scene` | Scene drawing (picture replay OR live render) | `render()` |
| `render:recordPicture` | SkPicture recording | `recordScenePicture()` |
| `render:drawPicture` | SkPicture replay | `canvas.drawPicture()` |
| `render:volatile` | Live render (hover/drag/text edit) | volatile path |
| `render:sectionTitles` | Section title drawing | `drawSectionTitles()` |
| `render:componentLabels` | Component labels | `drawComponentLabels()` |
| `render:selection` | Selection borders/handles | `drawSelection()` |
| `render:rulers` | Ruler drawing | `drawRulers()` |
| `render:flush` | GPU command submission | `surface.flush()` |
| `layout:compute` | Yoga layout | `computeAllLayouts()` |

Replace the existing `console.time`/`console.timeEnd` calls (which already exist in the render method) with the structured User Timing API:

```ts
// Before (current)
console.time('render:flush')
this.surface.flush()
console.timeEnd('render:flush')

// After (with DevTools custom tracks)
const start = performance.now()
this.surface.flush()
performance.measure('flush', {
  start,
  detail: {
    devtools: {
      dataType: 'track-entry',
      track: 'Renderer',
      trackGroup: 'OpenPencil',
      color: 'tertiary'
    }
  }
})
```

### 3. GPU Timer Queries

Wrap the WebGL context to insert `EXT_disjoint_timer_query_webgl2` queries around the flush boundary:

```ts
class GpuTimer {
  private ext: EXT_disjoint_timer_query_webgl2 | null
  private pending: WebGLQuery[]
  private results: number[] // rolling buffer of GPU times in ms

  beginFrame(gl: WebGL2RenderingContext) { ... }
  endFrame(gl: WebGL2RenderingContext) { ... }
  pollResults(gl: WebGL2RenderingContext): number | null { ... }
}
```

Since results come back asynchronously (typically 1-4 frames later), the HUD shows the most recently completed GPU measurement, not the current frame's. This is the same approach Unity and Unreal use.

For accurate CPU vs GPU bottleneck detection (Figma's approach):
- `perceived_fps` = 1000 / rAF delta
- `cpu_fps` = 1000 / (JS render end − JS render start)  
- `gpu_fps` = 1000 / GPU timer query result

If `gpu_fps ≈ perceived_fps` and `cpu_fps >> perceived_fps` → **GPU-bound**  
If `cpu_fps ≈ perceived_fps` and `gpu_fps >> perceived_fps` → **CPU-bound**

### 4. Detailed Profiler (on-demand, higher overhead)

Triggered via debug menu or keyboard shortcut. Captures detailed per-node data for a single frame or short burst:

**Per-node metrics:**
- Time spent in `renderNode()` (cumulative, including children)
- Self time (excluding children)
- Number of draw calls generated
- Whether the node was culled
- Fill/stroke/effect complexity (number of paints, blur radii, etc.)

**Implementation:** A profiling wrapper around `renderNode()` that pushes/pops a stack:

```ts
private renderNodeProfiled(canvas, graph, nodeId, ...) {
  const entry = this.profilerStack.push(nodeId)
  entry.startTime = performance.now()
  this.renderNode(canvas, graph, nodeId, ...)
  entry.endTime = performance.now()
  this.profilerStack.pop()
}
```

**Overdraw visualization:** Skia has a built-in overdraw mode (`SkOverdrawCanvas` / `OverdrawColorFilter`). In CanvasKit, we can achieve this by rendering with `CanvasKit.MakeMatrix` color filter that maps draw count → heat colors. Alternative: render each node's bounds with additive blend to accumulate overdraw count as brightness.

**Output formats:**
- **In-canvas heatmap** — overlay showing per-pixel render cost (warm = slow)
- **Speedscope-compatible JSON** — export frame profile for viewing in https://www.speedscope.app/ (same format Figma's webgl-profiler uses)
- **Node table** — sorted list of most expensive nodes with self-time

### 5. Draw Call Counter

Proxy the WebGL context to count actual GL draw calls per frame:

```ts
function instrumentGL(gl: WebGL2RenderingContext) {
  let drawCalls = 0
  const origDrawArrays = gl.drawArrays.bind(gl)
  const origDrawElements = gl.drawElements.bind(gl)
  gl.drawArrays = (...args) => { drawCalls++; return origDrawArrays(...args) }
  gl.drawElements = (...args) => { drawCalls++; return origDrawElements(...args) }
  return {
    getAndReset() { const c = drawCalls; drawCalls = 0; return c }
  }
}
```

This is the standard technique used by Spector.js, WebGL Inspector, and every game engine's stat display.

---

## Implementation plan

### Phase 1: Foundation (`packages/core/src/profiler.ts`)

Create a `RenderProfiler` class that all layers use:

```ts
export class RenderProfiler {
  enabled = false
  hudVisible = false
  
  // Frame stats (always tracked when enabled, near-zero cost)
  readonly frameStats: FrameStats
  
  // Phase timing (User Timing API integration)
  beginPhase(name: string): void
  endPhase(name: string): void
  
  // GPU timer (optional, requires extension)
  readonly gpuTimer: GpuTimer | null
  
  // Draw call counter
  readonly drawCallCounter: DrawCallCounter | null
  
  // Detailed per-node profiling (on-demand)
  beginDetailedCapture(): void
  endDetailedCapture(): FrameCapture
  
  // HUD rendering (called by SkiaRenderer)
  drawHUD(canvas: Canvas, ck: CanvasKit): void
}
```

### Phase 2: Integrate into renderer

1. Add `profiler: RenderProfiler` to `SkiaRenderer`
2. Replace all `console.time`/`console.timeEnd` with `profiler.beginPhase`/`endPhase`
3. Add phase markers for every render stage
4. Wrap `surface.flush()` with GPU timing queries
5. Add HUD drawing at end of `render()` (in screen space, after everything else)

### Phase 3: HUD overlay

Render directly on the Skia canvas as the very last step (after rulers). Uses small monospace font, semi-transparent dark background. Positioned top-left or bottom-left, not interfering with rulers.

### Phase 4: GPU timing & bottleneck detection

1. Implement `GpuTimer` class with `EXT_disjoint_timer_query_webgl2`
2. Add CPU vs GPU bottleneck indicator to HUD
3. Handle graceful degradation when extension unavailable

### Phase 5: Detailed profiler & export

1. Per-node timing capture
2. Speedscope JSON export
3. Overdraw visualization mode
4. Node cost table (could display in dev panel or console)

---

## File structure

```
packages/core/src/
  profiler/
    index.ts              — re-exports
    render-profiler.ts    — main RenderProfiler class
    frame-stats.ts        — FPS/frame-time tracking with rolling averages
    gpu-timer.ts          — EXT_disjoint_timer_query wrapper
    draw-call-counter.ts  — WebGL proxy for draw call counting
    phase-timer.ts        — User Timing API / console.timeStamp integration
    hud-renderer.ts       — in-canvas HUD overlay drawing
    frame-capture.ts      — detailed per-node capture data structures
    speedscope-export.ts  — export to speedscope JSON format
```

## Activation

| Mechanism | What activates |
|-----------|---------------|
| `?profiling` URL param | Use profiling CanvasKit build with full WASM names |
| `Shift+P` keyboard shortcut | Toggle HUD overlay |
| `Shift+Alt+P` | Start/stop detailed frame capture |
| Dev menu → "Export frame profile" | Save speedscope JSON |
| Dev menu → "Show overdraw" | Toggle overdraw heatmap |
| `store.debug.profiler` | Programmatic control from Vue devtools |

## Key design principles

1. **Zero cost when off** — no allocations, no timing calls, no proxy overhead when profiler is disabled
2. **Minimal cost when HUD-only** — < 0.2ms overhead for the basic stats display  
3. **Render on canvas, not DOM** — HUD is drawn by Skia itself, no DOM overlays that could interfere with WebGL
4. **Async GPU results** — never stall the pipeline waiting for GPU query results; show N-2 frame's GPU time
5. **Production-safe** — the basic HUD and User Timing marks can ship in production behind a flag
6. **DevTools-native** — leverage Chrome's Performance panel extensibility for zero-overhead external profiling
7. **Export-friendly** — speedscope JSON format is the standard for flame chart sharing

## References

- [Skia Tracing](https://skia.org/docs/dev/tools/tracing) — Skia's internal `TRACE_EVENT` macros, Perfetto integration
- [Skia Debugger](https://debugger.skia.org) — SKP visual debugger with GPU op bounds
- [Skia Perf](https://skia.org/docs/dev/testing/skiaperf) — Skia's continuous perf monitoring with 400k+ metrics per commit
- [CanvasKit profiling build](https://www.npmjs.com/package/canvaskit-wasm) — `canvaskit-wasm/profiling` with full WASM function names
- [Figma webgl-profiler](https://github.com/figma/webgl-profiler) — Figma's GPU profiler using EXT_disjoint_timer_query, speedscope output
- [Skia render-skp.html](https://skia.googlesource.com/skia/+/052566d8ccb7/tools/perf-canvaskit-puppeteer/render-skp.html) — Skia's own CanvasKit benchmark: frame-to-frame timing methodology
- [EXT_disjoint_timer_query_webgl2 spec](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/) — WebGL GPU timing extension
- [Chrome Performance extensibility API](https://developer.chrome.com/docs/devtools/performance/extension) — Custom tracks via `performance.measure` detail.devtools
- [Unity Frame Timing Manager](https://docs.unity3d.com/2022.3/Documentation/Manual/frame-timing-manager.html) — CPU main thread / render thread / GPU split
- [Unreal Insights](https://dev.epicgames.com/documentation/en-us/unreal-engine/introduction-to-performance-profiling-and-configuration-in-unreal-engine) — Per-thread, per-GPU frame profiling
- Skia Milestone 132-133 release notes — `GrGLInterface` timer query support, `GpuStats.elapsedTime` for GPU time reporting
