# 04 — Architecture

## Общая архитектура

```
┌─────────────────────────────────────────────────────┐
│ VS Code                                             │
│                                                     │
│  ┌─────────────────────┐   ┌─────────────────────┐ │
│  │ Extension Host      │   │ Webview (Browser)    │ │
│  │ (Node.js)           │   │                      │ │
│  │                     │   │  CanvasKit WASM      │ │
│  │  .fig parser        │◄─►│  Renderer            │ │
│  │  Token Registry     │   │  Preview UI          │ │
│  │  Language Providers │   │                      │ │
│  │  Tree Providers     │   └─────────────────────┘ │
│  │  Commands           │                            │
│  └─────────────────────┘                            │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐                │
│  │ Sidebar      │  │ Custom Editor│                │
│  │ Pages Tree   │  │ .fig viewer  │                │
│  │ Components   │  │ (readonly)   │                │
│  │ Preview WV   │  │              │                │
│  └──────────────┘  └──────────────┘                │
└─────────────────────────────────────────────────────┘
         │
         ▼
    ┌──────────┐
    │ .fig     │    ← локальные файлы в workspace
    │ files    │
    └──────────┘
```

## Структура расширения

Расширение живёт в отдельной директории внутри репозитория OpenPencil. Монорепо-рефакторинг **не требуется**.

```
extensions/vscode/
  package.json            ← extension manifest
  tsconfig.json
  esbuild.mjs             ← два entry points: extension + webview
  schemas/
    openpencil-config.schema.json
  media/
    icon.svg
  src/
    extension.ts           ← activate/deactivate
    fig-editor-provider.ts ← CustomReadonlyEditorProvider для .fig
    sidebar/
      pages-tree.ts        ← TreeDataProvider: страницы
      components-tree.ts   ← TreeDataProvider: компоненты
      preview-provider.ts  ← WebviewViewProvider: preview panel
    tokens/
      registry.ts          ← Design Token Registry
      extractor.ts         ← SceneGraph → tokens
      completion.ts        ← CompletionItemProvider
      color-provider.ts    ← DocumentColorProvider
      hover-provider.ts    ← HoverProvider
    code-connect/
      code-lens.ts         ← CodeLensProvider
      linker.ts            ← маппинг код ↔ дизайн
    css-generator.ts       ← SceneNode → CSS string
    tailwind-generator.ts  ← SceneNode → Tailwind classes
    commands.ts            ← все registerCommand
  webview/
    index.html             ← webview HTML
    preview.ts             ← CanvasKit renderer для превью
    message-protocol.ts    ← типы сообщений extension ↔ webview
  dist/                    ← build output
```

## Подключение engine-кода

Engine-модули OpenPencil подключаются через esbuild alias без копирования:

> ⚠️ Alias `@/ → ../../src/` привязан к расположению `extensions/vscode/` в репозитории. При перемещении директории alias сломается. Альтернативы: `path.resolve(__dirname, '../../src')` для абсолютного пути, или tsconfig paths + esbuild-plugin-tsc.

```javascript
// esbuild.mjs
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const extensionConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['vscode'],
  outfile: 'dist/extension.js',
  alias: {
    '@': resolve(__dirname, '../../src')
  }
}

const webviewConfig = {
  entryPoints: ['webview/preview.ts'],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  outfile: 'dist/webview.js',
  alias: {
    '@': resolve(__dirname, '../../src')
  },
  loader: {
    '.wasm': 'file'
  }
}
```

Extension host бандл включает: scene-graph, kiwi codec, color, vector (decode), types.
Webview бандл включает: renderer, canvaskit, fonts, vector (toPath).

## Communication Protocol

Extension host ↔ Webview общаются через `postMessage`.

### Сообщения Extension → Webview

```typescript
type ExtensionMessage =
  | { type: 'render-node'; node: SerializedSceneNode; children: SerializedSceneNode[] }
  | { type: 'render-page'; pageId: string; nodes: SerializedSceneNode[] }
  | { type: 'clear' }
  | { type: 'set-theme'; theme: 'light' | 'dark' }
```

### Сообщения Webview → Extension

```typescript
type WebviewMessage =
  | { type: 'ready' }
  | { type: 'node-clicked'; nodeId: string }
  | { type: 'request-node'; nodeId: string }
  | { type: 'error'; message: string }
```

### Сериализация

SceneNode сериализуется в plain JSON (structuredClone-совместимый). Заливки, штрихи, эффекты передаются как есть. VectorNetwork передаётся как JSON. CanvasKit-специфичные объекты (Path, Paint) создаются в webview из переданных данных.

## Design Token Registry

### Извлечение токенов

Token Registry парсит SceneGraph и извлекает дизайн-токены:

```typescript
interface DesignToken {
  name: string           // "--op-primary-500"
  value: string          // "#3B82F6"
  type: 'color' | 'dimension' | 'typography' | 'spacing'
  source: {
    nodeId: string
    nodeName: string
    figFile: string
  }
}
```

### Правила идентификации токенов

1. **Из COMPONENT nodes**: все уникальные цвета, размеры шрифтов, spacing из компонентов верхнего уровня
2. **Naming convention**: имя компонента → имя токена
   - `Colors/Primary/500` → `--op-colors-primary-500`
   - `Typography/Heading/H1` → `--op-typography-heading-h1`
3. **Дедупликация**: одинаковые значения разных нод → один токен (первый по алфавиту)
4. **Конфликты**: если две ноды с разными именами дают одинаковое значение — оба токена сохраняются, но в autocomplete показывается warning

### Формат токенов

Рекомендация: **W3C Design Tokens Format** (DTCG) как основной, с экспортом в CSS Custom Properties и Tailwind config.

```json
{
  "color": {
    "primary": {
      "500": {
        "$type": "color",
        "$value": "#3B82F6"
      }
    }
  }
}
```

Причина: W3C DTCG — emerging стандарт, поддерживается Style Dictionary, Tokens Studio. CSS Custom Properties и Tailwind — производные форматы.

## `.openpencil.json` Config Schema

```json
{
  "$schema": "./node_modules/openpencil-vscode/schemas/openpencil-config.schema.json",
  "figFiles": ["design-system.fig", "ui-kit.fig"],
  "tokens": {
    "output": "src/tokens",
    "format": "css-custom-properties",
    "prefix": "op",
    "include": ["color", "typography", "spacing"],
    "exclude": []
  },
  "codeConnect": {
    "componentDir": "src/components",
    "mappings": {
      "Button": "0:123",
      "Card": "0:456"
    }
  },
  "tailwind": {
    "configPath": "tailwind.config.ts",
    "extendColors": true,
    "extendSpacing": true
  }
}
```

Поля:
- `figFiles` — какие .fig файлы индексировать (glob patterns)
- `tokens.output` — куда экспортировать токены
- `tokens.format` — формат: `css-custom-properties` | `tailwind` | `w3c-design-tokens`
- `tokens.prefix` — префикс для CSS custom properties
- `codeConnect.mappings` — ручной маппинг имя компонента → node ID в .fig
- `tailwind` — настройки интеграции с Tailwind config

## Code Connect: механизм связывания

### Способ 1: JSDoc аннотации

```vue
<script setup lang="ts">
/**
 * @openpencil-component 0:123
 * @openpencil-file design-system.fig
 */
defineProps<{
  variant: 'primary' | 'secondary'
}>()
</script>
```

Extension парсит `@openpencil-component` аннотации через regex и строит маппинг.

### Способ 2: конфигурационный маппинг

Через `codeConnect.mappings` в `.openpencil.json` — не требует изменения кода.

### Способ 3: naming convention

Если имя Vue-файла / компонента совпадает с именем COMPONENT node в .fig — автоматическая привязка:
- `Button.vue` ↔ COMPONENT с name "Button"
- `src/components/Card.vue` ↔ COMPONENT с name "Card"

Приоритет: JSDoc > конфиг > naming convention.

## Решения по Open Questions

### 1. Авторизация / API
**Решение: не нужна.** Работаем только с локальными .fig файлами. Нет облака, нет серверов. Если в будущем OpenPencil добавит облако — расширение получит auth через `vscode.authentication.registerAuthenticationProvider`.

### 2. Real-time синхронизация
**Решение: FileSystemWatcher.** Достаточно `vscode.workspace.createFileSystemWatcher('**/*.fig')`. При изменении .fig файла — перепарсить и обновить token registry. WebSocket не нужен.

### 3. Формат design tokens
**Решение: W3C DTCG** как внутренний формат. Экспорт в CSS Custom Properties / Tailwind config / JSON — конфигурируемо через `.openpencil.json`.

### 4. CanvasKit WASM bundle size
**Решение: приемлемо для Desktop VS Code.** ~5MB для canvaskit.wasm — сопоставимо с другими расширениями (Python extension ~50MB, C++ ~100MB). Для vscode.dev — неприемлемо, поэтому vscode.dev отложен.

### 5. VS Code Web (vscode.dev)
**Решение: desktop-only на старте.** WASM + WebGL в web worker context (vscode.dev) имеют дополнительные ограничения. Отложено до Phase 5. Extension manifest: только `main`, без `browser`.

### 6. Монорепо vs отдельная сборка
**Решение: отдельная сборка без монорепо.** esbuild alias `@/ → ../../src/` позволяет импортировать engine-код без рефакторинга основного проекта. Альтернатива (монорепо с packages/) — рассмотреть, когда extension вырастет до >5k строк собственного кода.
