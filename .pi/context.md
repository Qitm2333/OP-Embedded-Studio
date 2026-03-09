# Code Context

## Files Retrieved
1. `packages/core/src/tools/analyze.ts` (lines 1-391) - Full file: analyze tools, diff tools, eval tool
2. `packages/core/src/tools/vector.ts` (lines 1-264) - Full file: boolean ops, path ops, viewport, SVG/image export
3. `packages/core/src/tools/ai-adapter.ts` (lines 1-96) - Full file: Vercel AI SDK adapter
4. `packages/core/src/tools/read.ts` (lines 1-183) - Full file: query/read tools
5. `packages/core/src/tools/registry.ts` (lines 1-100) - Full file: ALL_TOOLS array

## analyze.ts — Tool Definitions

| Line | Tool Name |
|------|-----------|
| 128 | `analyze_colors` |
| 197 | `analyze_typography` |
| 251 | `analyze_spacing` |
| 295 | `analyze_clusters` |
| 356 | `diff_create` (under "Diff tools" section) |
| 398 | `diff_show` |
| 449 | `eval` |

**No `describe` tool exists** in analyze.ts or anywhere in the tools directory.

## read.ts — Tool Names

| Tool Name | Description |
|-----------|-------------|
| `get_selection` | Currently selected nodes |
| `get_page_tree` | Node tree of current page |
| `get_node` | Detailed properties by ID |
| `find_nodes` | Find by name/type |
| `get_components` | List components |
| `list_pages` | List all pages |
| `switch_page` | Switch page by name/ID |
| `get_current_page` | Current page name/ID |
| `page_bounds` | Bounding box of all page objects |
| `select_nodes` | Select nodes by ID |
| `list_fonts` | Fonts used on current page |

**Neither `get_jsx` nor `diff_jsx` exist** in read.ts or any other tool file.

## vector.ts — exportImage Tool (line ~225)

- **Default format:** `'PNG'`
- **Default scale:** `1` (min: 0.1, max: 4)
- **Base64 conversion:** Dual-path:
  - Node.js: `Buffer.from(data).toString('base64')`
  - Browser: `btoa(String.fromCharCode(...data))`
- Returns: `{ mimeType, base64, byteLength }`
- Falls back to error if `figma.exportImage` is unavailable

## ai-adapter.ts — Full Contents

- **`AIAdapterOptions`** interface: `getFigma()`, `onBeforeExecute?`, `onAfterExecute?`, `onFlashNodes?`
- **`toolsToAI()`** function: Converts `ToolDef[]` → Vercel AI SDK `tool()` objects
  - Accepts deps: `{ v: valibot, valibotSchema, tool }` (lazy imports)
  - Builds valibot schemas from `ParamDef` type declarations
  - Wraps each `execute` with before/after hooks and error catching
  - If tool `mutates` and returns node IDs, calls `onFlashNodes` for visual feedback
- **`paramToValibot()`**: Maps param types → valibot schemas
  - `string` → `v.string()` or `v.picklist()` if enum
  - `number` → `v.number()` with optional `minValue`/`maxValue` pipes
  - `boolean` → `v.boolean()`
  - `color` → `v.string()` with description
  - `string[]` → `v.array(v.string())` with `minLength(1)`
  - Non-required params wrapped in `v.optional()`
- **`extractNodeIds()`**: Extracts IDs from result objects (handles `id`, `selection[]`, `results[]`)

## registry.ts — ALL_TOOLS Array (84 tools total)

**Read (11):** get_selection, get_page_tree, get_node, find_nodes, get_components, list_pages, switch_page, get_current_page, page_bounds, select_nodes, list_fonts

**Create (7):** createShape, render, createComponent, createInstance, createPage, createVector, createSlice

**Modify (20):** setFill, setStroke, setEffects, updateNode, setLayout, setConstraints, setRotation, setOpacity, setRadius, setMinMax, setText, setFont, setFontRange, setTextResize, setVisible, setBlend, setLocked, setStrokeAlign, setTextProperties, setLayoutChild

**Structure (17):** deleteNode, cloneNode, renameNode, reparentNode, groupNodes, ungroupNode, flattenNodes, nodeToComponent, nodeBounds, nodeMove, nodeResize, nodeAncestors, nodeChildren, nodeTree, nodeBindings, nodeReplaceWith, arrangeNodes

**Variables (11):** listVariables, listCollections, getVariable, findVariables, createVariable, setVariable, deleteVariable, bindVariable, getCollection, createCollection, deleteCollection

**Vector & Export (14):** booleanUnion, booleanSubtract, booleanIntersect, booleanExclude, pathGet, pathSet, pathScale, pathFlip, pathMove, viewportGet, viewportSet, viewportZoomToFit, exportSvg, exportImage

**Analyze & Diff (6):** analyzeColors, analyzeTypography, analyzeSpacing, analyzeClusters, diffCreate, diffShow

**Eval (1):** evalCode

## Architecture

```
ToolDef (schema.ts)          -- type-safe tool definition with params + execute
  ├── read.ts                -- query tools (selection, find, pages, fonts)
  ├── create.ts              -- shape/component/page creation
  ├── modify.ts              -- property setters
  ├── structure.ts           -- tree operations
  ├── variables.ts           -- variable/collection CRUD
  ├── vector.ts              -- boolean ops, paths, viewport, export
  └── analyze.ts             -- analysis, diff, eval
        │
registry.ts                  -- assembles ALL_TOOLS array
        │
ai-adapter.ts                -- toolsToAI() → Vercel AI SDK tool() objects
                                (valibot schemas, before/after hooks, flash nodes)
```

Each `defineTool()` creates a `ToolDef` with typed params. The `registry.ts` collects all into `ALL_TOOLS[]`. The `ai-adapter.ts` converts them to Vercel AI SDK format with valibot validation schemas, injecting `FigmaAPI` at execution time via `getFigma()`.

## Start Here

- **`packages/core/src/tools/registry.ts`** — the central manifest of all 84 tools, organized by domain. Shows the full tool surface and imports from all domain files.
- **`packages/core/src/tools/ai-adapter.ts`** — the bridge between tool definitions and the AI chat system. Key to understanding how tools are exposed to LLMs.
