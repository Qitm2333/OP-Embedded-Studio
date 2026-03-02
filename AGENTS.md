# OpenPencil

Vue 3 + CanvasKit (Skia WASM) + Yoga WASM design editor. Tauri v2 desktop, also runs in browser.

**Roadmap:** `plan.md` — phases, tech stack, CLI architecture, test strategy, keyboard shortcuts.

## Monorepo

Bun workspace with three packages:

- `packages/core` — `@open-pencil/core`: scene graph, renderer, layout, codec, kiwi, clipboard, vector, snap, undo. Zero DOM deps, runs headless in Bun.
- `packages/cli` — `@open-pencil/cli`: headless CLI for .fig inspection, export, linting. Uses `citty` + `agentfmt`.
- `packages/mcp` — `@open-pencil/mcp`: MCP server for AI coding tools. Stdio + HTTP (Hono). Reuses `createServer()` factory with all core tools.

The root app (`src/`) is the Tauri/Vite desktop editor. Its `src/engine/` files are thin re-export shims from `@open-pencil/core`.

## Commands

- `bun run check` — lint + typecheck (run before committing)
- `bun run test:dupes` — jscpd copy-paste detection across all TS sources
- `bun run format` — oxfmt with import sorting
- `bun test ./tests/engine` — unit tests
- `bun run test` — Playwright visual regression
- `bun run tauri dev` — desktop app with hot reload
- `bun open-pencil info <file>` — document stats
- `bun open-pencil tree <file>` — node tree
- `bun open-pencil find <file>` — search nodes
- `bun open-pencil node <file> --id <id>` — detailed node properties
- `bun open-pencil pages <file>` — list pages
- `bun open-pencil variables <file>` — list design variables
- `bun open-pencil export <file>` — headless render to PNG/JPG/WEBP
- `bun open-pencil analyze colors <file>` — color palette usage
- `bun open-pencil analyze typography <file>` — font/size/weight stats
- `bun open-pencil analyze spacing <file>` — gap/padding values
- `bun open-pencil analyze clusters <file>` — repeated patterns

## Releases & CI

### How to release

1. Update version in `package.json`, `packages/core/package.json`, `packages/cli/package.json`, `desktop/tauri.conf.json`
2. Update `CHANGELOG.md` — move "Unreleased" items under new version heading with date
3. Commit: `Release v0.x.y`
4. Tag: `git tag v0.x.y && git push --tags`
5. The `build.yml` workflow triggers on `v*` tags and:
   - Builds Tauri binaries for macOS (arm64 + x64), Windows (x64 + arm64), Linux (x64)
   - Creates a draft GitHub Release with all platform binaries
   - Publishes `@open-pencil/core` and `@open-pencil/cli` to npm with provenance
6. Go to GitHub Releases → edit the draft → paste changelog section → publish

### CI workflows

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `build.yml` | `v*` tag push or manual | Build Tauri desktop apps (5 targets), create GitHub Release, publish npm |
| `app.yml` | Push to `master` (non-docs) | Build web app, deploy to Cloudflare Pages (`app.openpencil.dev`) |
| `docs.yml` | Push to `master` (`packages/docs/**`) | Build VitePress docs, deploy to Cloudflare Pages (`openpencil.dev`) |

### Before committing

Run all quality gates:

```sh
bun run check          # oxlint + typecheck
bun run format         # oxfmt
bun run test:dupes     # jscpd < 3%
bun run test:unit      # bun:test
bun run test           # Playwright E2E
```

## Documentation

- `CHANGELOG.md` — all user-facing changes, grouped by version. "Unreleased" section at top for in-progress work.
- `README.md` — user-facing: features, getting started, CLI, project structure. No implementation details.
- `AGENTS.md` (this file) — contributor/agent reference: architecture, conventions, how to release.
- `packages/docs/` — VitePress site deployed at `openpencil.dev`. User guide, reference, development docs.

When adding features, update `CHANGELOG.md` (Unreleased section) and `README.md` (if user-facing). Update `AGENTS.md` when architecture or conventions change.

## CLI

- All CLI output must use `agentfmt` formatters — `fmtList`, `fmtHistogram`, `fmtSummary`, `fmtNode`, `fmtTree`, `kv`, `entity`, `bold`, `dim`, etc.
- Don't hand-roll `console.log` formatting — use the helpers from `packages/cli/src/format.ts` which re-exports agentfmt with project-specific adapters (`nodeToData`, `nodeDetails`, `nodeToTreeNode`, `nodeToListItem`)
- Every command supports `--json` for machine-readable output

## Tools (AI / MCP / CLI)

- Tool operations are defined once in `packages/core/src/tools/schema.ts` as framework-agnostic `ToolDef` objects
- Each tool has: name, description, typed params, and an `execute(figma: FigmaAPI, args)` function
- `defineTool()` gives type-safe params in the execute body; the array `ALL_TOOLS` erases the generics for adapters
- AI adapter (`packages/core/src/tools/ai-adapter.ts`): `toolsToAI()` converts ToolDefs → valibot schemas + Vercel AI `tool()` wrappers
- `src/ai/tools.ts` is just a thin wire: creates FigmaAPI from editor store, calls `toolsToAI()`
- CLI commands (`packages/cli/src/commands/`) are **not** generated from ToolDefs — they have custom agentfmt formatting, tree walking, pagination. The `eval` command is the CLI's access to all ToolDef operations via FigmaAPI.
- MCP adapter (`packages/mcp/src/server.ts`): `createServer()` converts ToolDefs → zod schemas + MCP `registerTool()`. Adds `open_file`, `save_file`, `new_document` for headless file ops. Two entry points: `index.ts` (stdio), `http.ts` (Hono + Streamable HTTP with sessions).
- To add a new tool: add a `defineTool()` in `schema.ts`, add to `ALL_TOOLS` array — it's instantly available in AI chat, MCP, and via `eval` in CLI
- `FigmaAPI` (`packages/core/src/figma-api.ts`) is the execution target for all tools — Figma Plugin API compatible, uses Symbols for hidden internals

## Collaboration

- P2P via Trystero (WebRTC) — no server relay. Signaling over MQTT public brokers.
- Yjs CRDT for document state sync. Awareness protocol for cursors/selections/presence.
- y-indexeddb for local persistence — room survives page refresh.
- Constants in `src/constants.ts`: `TRYSTERO_APP_ID`, `PEER_COLORS`, `ROOM_ID_LENGTH`, `ROOM_ID_CHARS`, `YJS_JSON_FIELDS`
- `src/composables/use-collab.ts` — composable: connect/disconnect, cursor/selection broadcasting, follow mode, Yjs ↔ SceneGraph sync
- Provided via `COLLAB_KEY` injection — `useCollabInjected()` in child components
- ICE servers: Google STUN + Cloudflare STUN + Open Relay TURN (TCP + UDP)
- Room IDs use `crypto.getRandomValues()` — no `Math.random()` anywhere in codebase
- Stale cursors cleaned on peer disconnect via `removeAwarenessStates()`

## Code conventions

- `@/` import alias for app cross-directory imports, relative imports within core
- No `any` — use proper types, generics, declaration merging
- No `!` non-null assertions — use guards, `?.`, `??`
- No `Math.random()` — use `crypto.getRandomValues()` everywhere
- Shared types (GUID, Color, Vector, Matrix, Rect) live in `packages/core/src/types.ts`
- Window API extensions (showOpenFilePicker, queryLocalFonts) live in `src/global.d.ts` and `packages/core/src/global.d.ts`
- Use `culori` for color conversions — don't reimplement parseColor/colorToRgba
- Use `@vueuse/core` hooks (useEventListener, etc.) — don't do manual addEventListener/removeEventListener
- `packages/core/src/kiwi/kiwi-schema/` is vendored — don't modify
- Core code must guard browser APIs: `typeof window !== 'undefined'`, `typeof document === 'undefined'`
- Constants in `src/constants.ts` — no magic numbers in components or composables

## Rendering

- Canvas is CanvasKit (Skia WASM) on a WebGL surface, not DOM
- `renderVersion` vs `sceneVersion`: `renderVersion` = canvas repaint (pan/zoom/hover); `sceneVersion` = scene graph mutations. UI panels watch `sceneVersion` only.
- `requestRender()` bumps both counters; `requestRepaint()` bumps only `renderVersion`
- `renderNow()` is only for surface recreation and font loading (need immediate draw)
- Resize observer uses rAF throttle, not debounce — debounce causes canvas skew
- Viewport culling skips off-screen nodes; unclipped parents are NOT culled (children may extend beyond bounds)
- Selection border width must be constant regardless of zoom — divide by scale
- Section/frame title text never scales — render at fixed font size, ellipsize to fit
- Rulers are rendered on the canvas (not DOM), with selection range badges that don't overlap tick numbers
- Remote cursors: Figma-style colored arrows with white border + name pill, rendered in screen space

## Scene graph

- Nodes live in flat `Map<string, SceneNode>`, tree via `parentIndex` references
- Frames clip content by default is OFF (unlike what you'd assume)
- When creating auto-layout, sort children by geometric position first
- Dragging a child outside a frame should reparent it, not clip it
- Layer panel tree must react to reparenting — watch for stale children refs
- Groups: creating a group must preserve children's visual positions

## Components & instances

- Purple (#9747ff) for COMPONENT, COMPONENT_SET, INSTANCE — matches Figma
- Instance children map to component children via `componentId` for 1:1 sync
- Override key format: `"childId:propName"` in instance's `overrides` record
- Editing a component must call `syncIfInsideComponent()` to propagate to instances
- `SceneGraph.copyProp<K>()` typed helper — uses `structuredClone` for arrays

## Layout

- `computeAllLayouts()` must be called after demo creation and after opening .fig files
- Yoga WASM handles flexbox; CSS Grid blocked on upstream (facebook/yoga#1893)
- Auto-layout creation (Shift+A) must recompute layout immediately to update selection bounds

## UI

- Use reka-ui for UI components (Splitter, ContextMenu, DropdownMenu, etc.)
- Tailwind 4 for styling — no inline CSS, no component-level `<style>` blocks
- Mac keyboards: use `e.code` not `e.key` for shortcuts with modifiers (Option transforms characters)
- Splitter resize handles need inner div with `pointer-events-none` for sizing (zero-width handle collapses without it)
- Number input spinner hiding is global CSS in `app.css`, not per-component
- ScrubInput (drag-to-change number) — cursor and pointerdown on outer container, not inner spans
- Icons: use unplugin-icons with Iconify/Lucide (`<icon-lucide-*>`) — don't use raw SVG or Unicode symbols
- Sections are draggable by title pill, not by the area to the right of the title
- CSS `contain: paint layout style` on side panels to isolate repaints from WebGL canvas

## File format

- .fig files use Kiwi binary codec — schema in `packages/core/src/kiwi/codec.ts`
- `NodeChange` is the central type for Kiwi encode/decode
- Vector data uses reverse-engineered `vectorNetworkBlob` binary format — encoder/decoder in `packages/core/src/vector.ts`
- showOpenFilePicker/showSaveFilePicker are File System Access API (Chrome/Edge), not Tauri-only — code has fallbacks
- Tauri detection: `IS_TAURI` constant from `packages/core/src/constants.ts` — don't use `'__TAURI_INTERNALS__' in window` inline
- .fig export: compression with fflate (browser) or Tauri Rust commands
- Test .fig round-trip by exporting and reimporting in Figma
- Test fixtures (`tests/fixtures/*.fig`) are Git LFS — use `git push --no-verify` to skip the slow LFS pre-push hook. Use regular `git push` only when `.fig` fixtures changed.

## Tauri

- Tauri v2 with plugin-dialog, plugin-fs, plugin-opener
- File system permissions must be configured in `desktop/tauri.conf.json` — "Internal error" on save means missing permissions
- Dev tools: add a menu item to toggle, don't rely on keyboard shortcut

## Publishing

- `bun publish` from package dirs — resolves `workspace:*` → actual versions
- Core: `prepublishOnly` runs `tsc` to build `dist/` for Node.js consumers
- CLI requires Bun runtime (`#!/usr/bin/env bun`)

## Reference

[figma-use](https://github.com/dannote/figma-use) — our Figma toolkit. Use as reference for:
- Kiwi binary format, schema, encode/decode (`packages/shared/src/kiwi/`)
- Figma WebSocket multiplayer protocol (`packages/plugin/src/ws/`)
- Vector network blob format (`packages/shared/src/vector/`)
- Node types, paints, effects, layout fields (`packages/shared/src/types/`)
- MCP tools / design operations (`packages/mcp/`)
- JSX-to-design renderer (`packages/render/`)
- Design linter rules (`packages/linter/`)

## Known issues

- Safari ew-resize/col-resize/ns-resize cursor bug (WebKit #303845) — fixed in Safari 26.3 Beta
