# 03 — VS Code API Integration

Маппинг функциональности расширения на конкретные VS Code API.

## Contribution Points (package.json)

### `contributes.customEditors`
Открытие `.fig` файлов в VS Code как custom editor.

```jsonc
{
  "customEditors": [{
    "viewType": "openPencil.figEditor",
    "displayName": "OpenPencil Design",
    "selector": [{ "filenamePattern": "*.fig" }],
    "priority": "default"
  }]
}
```

**API:** `CustomReadonlyEditorProvider` (не `CustomEditorProvider` — .fig файлы не редактируются в VS Code, только просматриваются).

Почему `CustomReadonlyEditorProvider`, а не `CustomEditorProvider`:
- .fig — бинарный формат, VS Code TextDocument не подходит
- Редактирование .fig требует полный editor (OpenPencil app), не VS Code
- Readonly избавляет от имплементации save, backup, undo в extension

### `contributes.viewsContainers`
Activity Bar иконка OpenPencil.

```jsonc
{
  "viewsContainers": {
    "activitybar": [{
      "id": "openPencil",
      "title": "OpenPencil",
      "icon": "media/icon.svg"
    }]
  }
}
```

### `contributes.views`
Tree views в sidebar.

```jsonc
{
  "views": {
    "openPencil": [
      { "id": "openPencil.pages", "name": "Pages", "type": "tree" },
      { "id": "openPencil.components", "name": "Components", "type": "tree" },
      { "id": "openPencil.preview", "name": "Preview", "type": "webview" }
    ]
  }
}
```

### `contributes.commands`

| Command | Title | Когда |
|---------|-------|-------|
| `openPencil.openFile` | Open .fig File | Всегда |
| `openPencil.copyCSS` | Copy CSS | Элемент выбран |
| `openPencil.copyTailwind` | Copy Tailwind | Элемент выбран |
| `openPencil.inspectElement` | Inspect Element | Элемент выбран |
| `openPencil.refreshTokens` | Refresh Design Tokens | .fig файл открыт |
| `openPencil.openInApp` | Open in OpenPencil | .fig файл открыт |

### `contributes.configuration`

```jsonc
{
  "configuration": {
    "title": "OpenPencil",
    "properties": {
      "openPencil.tokenFormat": {
        "type": "string",
        "enum": ["css-custom-properties", "tailwind", "w3c-design-tokens"],
        "default": "css-custom-properties",
        "description": "Output format for design tokens"
      },
      "openPencil.autoDetectFigFiles": {
        "type": "boolean",
        "default": true,
        "description": "Auto-detect .fig files in workspace"
      },
      "openPencil.tokenNamingConvention": {
        "type": "string",
        "enum": ["kebab-case", "camelCase", "snake_case"],
        "default": "kebab-case"
      }
    }
  }
}
```

### `contributes.jsonValidation`
Валидация `.openpencil.json` конфига.

```jsonc
{
  "jsonValidation": [{
    "fileMatch": ".openpencil.json",
    "url": "./schemas/openpencil-config.schema.json"
  }]
}
```

## Language Feature Providers

### `DocumentColorProvider`
Inline color swatches для дизайн-токенов в CSS/SCSS/Vue/TSX файлах.

```typescript
vscode.languages.registerColorProvider(
  [
    { language: 'css' },
    { language: 'scss' },
    { language: 'vue' },
    { language: 'typescriptreact' }
  ],
  colorProvider
)
```

Сканирует документ на вхождения CSS custom properties (--op-color-*) или hex-значений, совпадающих с дизайн-токенами. Показывает VS Code color picker с привязкой к token registry.

### `CompletionItemProvider`
Autocomplete для дизайн-токенов.

```typescript
vscode.languages.registerCompletionItemProvider(
  [{ language: 'css' }, { language: 'scss' }, { language: 'vue' }],
  tokenCompletionProvider,
  '-' // trigger на '--'
)
```

Предлагает `--op-primary-500`, `--op-font-heading`, `--op-spacing-md` и т.д. при наборе CSS custom properties. Каждый CompletionItem содержит:
- `detail`: hex-значение или размер
- `documentation`: MarkdownString с preview
- `kind`: CompletionItemKind.Color / .Value

### `HoverProvider`
Hover на CSS custom property → popup с превью цвета/значения из дизайна.

```typescript
vscode.languages.registerHoverProvider(
  [{ language: 'css' }, { language: 'scss' }, { language: 'vue' }],
  tokenHoverProvider
)
```

### `CodeLensProvider`
CodeLens над Vue/React компонентами, связанными с дизайн-компонентами.

```typescript
vscode.languages.registerCodeLensProvider(
  [{ language: 'vue' }, { language: 'typescriptreact' }],
  codeLensProvider
)
```

Показывает "🎨 View in OpenPencil" над компонентами с аннотацией `@openpencil-component`.

## TreeDataProvider

### Pages Tree
Показывает все страницы (CANVAS nodes) из .fig файла:
```
📄 Page 1
📄 Page 2
📄 Components
```

### Components Tree
Показывает все COMPONENT и COMPONENT_SET nodes:
```
◇ Button
  ◇ Button/Primary
  ◇ Button/Secondary
◇ Card
◇ Input
```

Каждый TreeItem имеет `contextValue` для контекстного меню ("Copy CSS", "Inspect").

## WebviewViewProvider

### Preview Panel
Рендерит выбранный элемент дизайна через CanvasKit в webview.

CSP для webview (подтверждено на примерах pixcil, crabviz, audio-preview):
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'none';
  script-src 'nonce-${nonce}' 'wasm-unsafe-eval';
  style-src ${webview.cspSource};
  img-src ${webview.cspSource} blob:;
  connect-src ${webview.cspSource};
">
```

Ключевое: `'wasm-unsafe-eval'` разрешает загрузку CanvasKit WASM.

Communication: extension host ↔ webview через `postMessage` / `onDidReceiveMessage`.

## FileSystemWatcher

```typescript
const watcher = vscode.workspace.createFileSystemWatcher('**/*.fig')
watcher.onDidChange(uri => refreshDesignTokens(uri))
watcher.onDidCreate(uri => indexFigFile(uri))
watcher.onDidDelete(uri => removeFromTokenRegistry(uri))
```

## StatusBarItem

```typescript
const statusBar = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Right,
  100
)
statusBar.text = '$(paintcan) OpenPencil: 3 files'
statusBar.command = 'openPencil.showFiles'
```

## Activation Events

```jsonc
{
  "activationEvents": [
    "onCustomEditor:openPencil.figEditor",
    "workspaceContains:**/*.fig"
  ]
}
```

Расширение активируется при:
1. Открытии .fig файла
2. Наличии .fig файлов в workspace (для autocomplete и token indexing)

## Чего НЕ используем

| API | Причина отказа |
|-----|---------------|
| `WebviewPanel` (standalone) | Дублирует `CustomReadonlyEditorProvider` для .fig файлов |
| `CustomEditorProvider` (writable) | .fig не редактируется в VS Code |
| `CustomTextEditorProvider` | .fig — бинарный формат |
| `DebugAdapterDescriptorFactory` | Не применимо |
| `AuthenticationProvider` | Local-first, нет облака |
