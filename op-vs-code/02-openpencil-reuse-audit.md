# 02 — OpenPencil Reuse Audit

Верифицированный аудит модулей OpenPencil на предмет переиспользования в VS Code расширении.

**Дата аудита:** 2026-03-01, ветка `open-pencil-vscode`.

Методология: проверены все `import` statements каждого файла через `rg "^import" src/engine/*.ts src/kiwi/*.ts`. Vue, Tauri и DOM-зависимости — блокеры для переиспользования в Node.js extension host. При изменении import-структуры аудит требует повторной валидации.

## Вердикт по модулям

### ✅ Полностью переиспользуемы (0 Vue/DOM зависимостей)

#### `src/types.ts`
```
Экспортирует: GUID, Color, Vector, Matrix, Rect
Импорты: нет
Вердикт: ✅ чистый TypeScript, переиспользуемо без изменений
```

#### `src/engine/scene-graph.ts`
```
Импорты:
  - import type { Color, Matrix, Rect } from '@/types'
Экспортирует: SceneNode, SceneGraph, NodeType, Fill, Stroke, Effect, VectorNetwork, ...
Vue: нет
DOM: нет
Вердикт: ✅ чистый TypeScript, ~800 строк типов + класс SceneGraph
```

#### `src/engine/color.ts`
```
Импорты:
  - import { parse, formatHex, converter } from 'culori'
  - import type { Color } from '@/types'
Экспортирует: parseColor, colorToHex, colorToRgba255, rgba255ToColor, colorToFill
Vue: нет
DOM: нет
Вердикт: ✅ зависимость culori работает в Node.js
```

#### `src/engine/vector.ts`
```
Импорты:
  - import type { VectorVertex, VectorSegment, ... } from './scene-graph'  (типы)
  - import type { CanvasKit, Path } from 'canvaskit-wasm'  (типы)
Экспортирует: decodeVectorNetworkBlob, encodeVectorNetworkBlob, vectorNetworkToPath
Vue: нет
DOM: нет
Вердикт: ✅ decode/encode — чистый TypeScript. vectorNetworkToPath зависит от CanvasKit runtime — доступен только в webview
```

#### `src/engine/snap.ts`
```
Импорты:
  - import type { SceneNode } from './scene-graph'
  - import type { Rect } from '@/types'
Экспортирует: SnapGuide, findSnapGuides, ...
Vue: нет
DOM: нет
Вердикт: ✅ чистая математика
```

#### `src/engine/undo.ts`
```
Импорты:
  - import type { SceneNode } from './scene-graph'
Экспортирует: UndoManager
Vue: нет
DOM: нет
Вердикт: ✅ чистый TypeScript
```

#### `src/kiwi/fig-file.ts`
```
Импорты:
  - import { unzipSync, inflateSync } from 'fflate'
  - import { decompress as zstdDecompress } from 'fzstd'
  - import { importNodeChanges } from './fig-import'
  - import { decodeBinarySchema, compileSchema, ByteBuffer } from './kiwi-schema'
  - import { isZstdCompressed } from './protocol'
  - import type { FigmaMessage } from './codec'
  - import type { SceneGraph } from '@/engine/scene-graph'
Vue: нет
DOM: нет
Node.js: fflate и fzstd — isomorphic (работают в Node.js и browser)
Вердикт: ✅ переиспользуемо в extension host
```

#### `src/kiwi/fig-import.ts`
```
Импорты:
  - import { SceneGraph } from '@/engine/scene-graph'
  - import { decodeVectorNetworkBlob } from '@/engine/vector'
  - import type { NodeChange, Paint, Effect, GUID } from './codec'
Vue: нет
DOM: нет
Вердикт: ✅ парсинг Kiwi NodeChange[] → SceneGraph
```

#### `src/kiwi/codec.ts`
```
Импорты:
  - import { decompress as zstdDecompress } from 'fzstd'
  - import { parseColor } from '@/engine/color'
  - import { compileSchema, encodeBinarySchema } from './kiwi-schema'
  - import { isZstdCompressed, getKiwiMessageType } from './protocol'
  - import figmaSchema from './schema'
  - import type { Schema } from './kiwi-schema'
  - import type { Color, GUID, Matrix, Vector } from '@/types'
Vue: нет
DOM: нет
Вердикт: ✅ Kiwi encode/decode pipeline
```

#### `src/kiwi/kiwi-schema/` (vendored)
```
Вердикт: ✅ чистый JavaScript, Kiwi binary codec
```

#### `src/kiwi/schema.ts`, `src/kiwi/protocol.ts`
```
Вердикт: ✅ чистые TypeScript/JS утилиты
```

### ⚠️ Частично переиспользуемы

#### `src/engine/renderer.ts`
```
Импорты:
  - import { ... } from '@/constants'  (pure values)
  - import { vectorNetworkToPath } from './vector'
  - import type { SceneNode, SceneGraph, Fill } from './scene-graph'
  - import type { SnapGuide } from './snap'
  - import type { Rect } from '@/types'
  - import type { EmbindEnumEntity, Image, Path } from 'canvaskit-wasm'
Vue: нет
DOM: нет — но зависит от CanvasKit runtime (WASM + WebGL)
Вердикт: ⚠️ работает только в webview с CanvasKit. В extension host (Node.js) — нет WebGL.
Стратегия: использовать в webview-части расширения для рендеринга превью.
```

#### `src/engine/layout.ts`
```
Импорты:
  - import Yoga, { ... } from 'yoga-layout'
  - import type { SceneGraph, SceneNode } from './scene-graph'
Vue: нет
DOM: нет
Вердикт: ⚠️ Yoga WASM. Работает в Node.js (yoga-layout имеет Node.js bindings).
Стратегия: можно использовать в extension host для расчёта layout, но нужно проверить WASM loading в VS Code extension context.
```

#### `src/engine/clipboard.ts`
```
Импорты:
  - import { inflateSync, deflateSync } from 'fflate'
  - import { initCodec, ... } from '@/kiwi/codec'
  - import { decodeVectorNetworkBlob, encodeVectorNetworkBlob } from './vector'
  - import type { NodeChange } from '@/kiwi/codec'
Vue: нет
DOM: нет напрямую, но clipboard API — browser-only
Вердикт: ⚠️ encode/decode функции переиспользуемы, clipboard доступ — browser only
```

#### `src/engine/fig-export.ts`
```
Импорты:
  - import { zipSync, deflateSync } from 'fflate'
  - import { IS_TAURI } from '@/constants'
  - import { initCodec, ... } from '@/kiwi/codec'
  - import { encodeVectorNetworkBlob } from './vector'
  - import type { SkiaRenderer } from './renderer'
  - import type { SceneGraph, SceneNode } from './scene-graph'
  - import type { NodeChange, Paint } from '@/kiwi/codec'
  - import type { CanvasKit } from 'canvaskit-wasm'
Vue: нет
DOM: нет
Вердикт: ⚠️ зависит от IS_TAURI (Tauri-specific пути) и SkiaRenderer (CanvasKit). Encode логика переиспользуемая, но thumbnail generation требует CanvasKit.
```

### ❌ Не переиспользуемы в extension host

#### `src/stores/editor.ts`
```
Импорты:
  - import { reactive, shallowRef, computed } from 'vue'
  - и все engine-модули
Вердикт: ❌ Vue reactivity system. Содержит ~1700 строк бизнес-логики, завязанной на Vue reactive().
Стратегия: переписать state management для extension на чистом TypeScript (EventEmitter pattern).
```

#### `src/components/*.vue`
```
Вердикт: ❌ Vue SFC. Не используемы в extension host.
Стратегия: для webview — отдельный UI (vanilla HTML/CSS/JS или lite framework).
```

#### `src/composables/*.ts`
```
Вердикт: ❌ Vue composables (useEventListener, useCanvas, etc.)
```

#### `src/engine/canvaskit.ts`
```
Импорты:
  - import CanvasKitInit, { type CanvasKit } from 'canvaskit-wasm'
Вердикт: ❌ для extension host (нет WebGL). ✅ для webview.
```

#### `src/engine/fonts.ts`
```
Импорты:
  - import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'
Вердикт: ❌ для extension host. ✅ для webview.
```

## Сводная таблица

| Модуль | Extension Host (Node.js) | Webview (Browser) | Зависимости |
|--------|-------------------------|-------------------|-------------|
| `types.ts` | ✅ | ✅ | — |
| `engine/scene-graph.ts` | ✅ | ✅ | `@/types` |
| `engine/color.ts` | ✅ | ✅ | `culori` |
| `engine/vector.ts` (decode/encode) | ✅ | ✅ | `@/types` |
| `engine/vector.ts` (toPath) | ❌ | ✅ | `canvaskit-wasm` |
| `engine/snap.ts` | ✅ | ✅ | `@/types` |
| `engine/undo.ts` | ✅ | ✅ | — |
| `kiwi/*` | ✅ | ✅ | `fflate`, `fzstd` |
| `engine/renderer.ts` | ❌ | ✅ | `canvaskit-wasm` |
| `engine/layout.ts` | ⚠️ | ✅ | `yoga-layout` (WASM) |
| `engine/clipboard.ts` (codec) | ✅ | ✅ | `fflate` |
| `engine/fig-export.ts` (encode) | ✅ | ✅ | `fflate` |
| `stores/editor.ts` | ❌ | ❌ | `vue` |
| `components/*.vue` | ❌ | ❌ | `vue` |
| `composables/*.ts` | ❌ | ❌ | `vue` |
| `engine/canvaskit.ts` | ❌ | ✅ | `canvaskit-wasm` |
| `engine/fonts.ts` | ❌ | ✅ | `canvaskit-wasm` |

## Вывод

**~70% engine-кода переиспользуемо** в extension host без модификаций. Ключевые модули (scene-graph, kiwi codec, color, vector decode) — чистый TypeScript без framework-зависимостей.

Для рендеринга превью в sidebar нужен webview с CanvasKit — `renderer.ts`, `canvaskit.ts`, `fonts.ts` используются там.

Монорепо-рефакторинг не обязателен: достаточно esbuild alias `@/` → `../src/` в extension build, чтобы импортировать engine-код напрямую.
