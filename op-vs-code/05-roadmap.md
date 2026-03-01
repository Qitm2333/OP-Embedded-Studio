# 05 — Roadmap

Фазированный план реализации OpenPencil for VS Code.

## Phase 0 — PoC Spike (1 неделя)

Цель: **доказать техническую возможность** до начала полной разработки.

### Задачи

- [ ] Создать минимальный VS Code extension (`extensions/vscode/`)
- [ ] Загрузить CanvasKit WASM в webview с CSP `'wasm-unsafe-eval'`
- [ ] Отрендерить простой прямоугольник через CanvasKit в sidebar WebviewView
- [ ] Прочитать .fig файл через `vscode.workspace.fs` + Kiwi codec в extension host
- [ ] Передать SceneNode из extension host в webview через postMessage
- [ ] Отрендерить переданную ноду в webview
- [ ] Проверить загрузку yoga-layout WASM в extension host (Node.js context)

### Критерии успеха

1. CanvasKit инициализируется в webview без ошибок CSP
2. WebGL context создаётся (проверить: `canvas.getContext('webgl2')`)
3. .fig файл парсится в extension host (Node.js) через Kiwi codec
4. Нода визуализируется в sidebar preview

### Риски и fallback

| Риск | Вероятность | Fallback |
|------|------------|----------|
| CanvasKit не грузится в webview | Низкая (pixcil, crabviz подтвердили) | Canvas 2D renderer |
| WebGL context unavailable | Низкая (Electron поддерживает) | SVG rendering |
| Kiwi codec не работает в Node.js | Низкая (fflate/fzstd isomorphic) | Worker thread |
| postMessage latency >100ms для больших SceneGraph | Средняя | Pagination, lazy loading |

---

## Phase 1 — MVP: Browse & Preview (3-4 недели)

Цель: **открыть .fig файлы в VS Code и просматривать дизайн.**

### Задачи

- [ ] `CustomReadonlyEditorProvider` для .fig файлов
  - Открытие .fig → парсинг Kiwi → отображение в webview
  - Навигация по страницам
  - Выбор элемента кликом → highlight
- [ ] Sidebar: Activity Bar icon + View Container "OpenPencil"
- [ ] TreeDataProvider: дерево страниц
  - Список CANVAS nodes
  - Клик → переключение страницы в preview
- [ ] TreeDataProvider: дерево компонентов
  - Список COMPONENT / COMPONENT_SET nodes
  - Иерархия с expand/collapse
  - Клик → фокус на компоненте в preview
- [ ] WebviewViewProvider: preview panel
  - CanvasKit renderer (переиспользуем `renderer.ts`)
  - Pan/zoom
  - Выделение элемента
- [ ] Команда `openPencil.openFile` — Quick Pick для выбора .fig файла
- [ ] StatusBarItem — "◆ OpenPencil: N files"
- [ ] FileSystemWatcher — автодетект .fig файлов в workspace
- [ ] Базовая CSS-генерация для выбранного элемента (position, size, colors, border-radius)

### Deliverable
Пользователь может: открыть .fig файл → увидеть дизайн → выбрать элемент → скопировать CSS.

---

## Phase 2 — Design Tokens & Autocomplete (3-4 недели)

Цель: **автоматическое извлечение стилей из дизайна в код.**

### Задачи

- [ ] Token Registry
  - Парсинг SceneGraph → извлечение уникальных цветов, шрифтов, размеров
  - Именование через node naming convention
  - Кэширование — перепарсинг только при изменении .fig
- [ ] `.openpencil.json` конфиг
  - JSON Schema для валидации
  - Настройки: figFiles, token format, prefix, include/exclude
- [ ] `CompletionItemProvider`
  - Autocomplete CSS custom properties из дизайн-токенов
  - Trigger на `--` (CSS custom property prefix)
  - Color preview в completion detail
  - Поддержка: CSS, SCSS, Vue `<style>`, TSX inline styles
- [ ] `DocumentColorProvider`
  - Inline color swatches для дизайн-токенов в коде
  - Привязка к VS Code color picker
- [ ] `HoverProvider`
  - Hover на `--op-*` → popup: hex value, preview, source node name
- [ ] Export command: "Export Design Tokens"
  - → CSS Custom Properties файл
  - → W3C Design Tokens JSON
  - → Tailwind config extend
- [ ] Tailwind integration
  - Генерация `colors`, `spacing`, `fontSize` из токенов
  - Вставка в `tailwind.config.ts` через AST-модификацию

### Deliverable
Пользователь может: писать CSS → получать autocomplete из дизайна → видеть inline color swatches → экспортировать токены.

---

## Phase 3 — Code Connect & Inspect (3-4 недели)

Цель: **связать компоненты кода с компонентами дизайна.**

### Задачи

- [ ] Code Connect linker
  - Парсинг `@openpencil-component` JSDoc аннотаций
  - Маппинг через `.openpencil.json` → `codeConnect.mappings`
  - Автоматический naming convention match
- [ ] `CodeLensProvider`
  - "🎨 View in OpenPencil" над компонентами с привязкой
  - Клик → sidebar фокусируется на этом компоненте
- [ ] Inspect panel
  - Выбранный элемент → CSS properties panel в sidebar
  - Табы: CSS, Tailwind, Raw Properties
  - Copy to clipboard
- [ ] Tailwind class generation
  - SceneNode → набор Tailwind utility classes
  - `bg-[#3B82F6] rounded-lg p-4 flex gap-4`
- [ ] Bidirectional navigation
  - Из CodeLens → sidebar preview компонента
  - Из sidebar (выбор компонента) → переход к файлу с `@openpencil-component`
- [ ] Context menu в .vue/.tsx файлах
  - "OpenPencil: Inspect Component"
  - "OpenPencil: Link to Design Component"

### Deliverable
Пользователь может: видеть CodeLens над компонентами → кликнуть → увидеть дизайн → скопировать Tailwind classes.

---

## Phase 4 — Token Sync & Drift Detection (2-3 недели)

Цель: **автоматическое обновление токенов и обнаружение расхождений.**

### Задачи

- [ ] Auto-export при изменении .fig файла
  - FileSystemWatcher → перепарсить → обновить CSS/Tailwind файлы
  - Notification: "Design tokens updated from design-system.fig"
- [ ] Token diff
  - Сравнение текущих токенов в коде vs. в .fig файле
  - DiagnosticCollection: warning для устаревших токенов
  - Quick Fix: "Update to new value from design"
- [ ] Drift report command
  - "OpenPencil: Show Drift Report"
  - TreeView с несоответствиями: added / removed / changed tokens

### Deliverable
Пользователь может: получать уведомления при обновлении дизайна → видеть diagnostics для устаревших токенов → auto-fix.

### ⚠️ Ограничения

"Drift detection" между произвольным кодом и дизайном — фундаментально сложная задача. Phase 4 ограничивается **token-level drift**: сравнение CSS custom property values с дизайн-токенами. Полный "visual regression" (screenshot comparison) выходит за scope.

---

## Phase 5 — VS Code Web & Advanced (future)

Цель: **расширение scope на web и advanced features.**

### Задачи (aspirational, no timeline)

- [ ] Web extension (`browser` entry point в manifest)
  - CanvasKit WASM в web worker
  - Fallback renderer (Canvas 2D / SVG) для ограниченных контекстов
- [ ] Multi-file token resolution
  - Объединение токенов из нескольких .fig файлов
  - Приоритеты и переопределения
- [ ] Design linter
  - Проверка: использует ли код токены из дизайн-системы или hardcoded values
  - Diagnostic: "Color #3B82F6 matches design token --op-primary-500. Consider using the token."
- [ ] Asset export
  - Экспорт SVG/PNG из элементов .fig файла
  - "Save asset to project" command
- [ ] Figma clipboard interop
  - Paste из Figma clipboard → вставка CSS/Tailwind в код

---

## Общая оценка

| Phase | Scope | Срок | Зависимости | Параллелизация |
|-------|-------|------|-------------|----------------|
| 0 | PoC Spike | 1 неделя | — | — |
| 1 | MVP: Browse & Preview | 3-4 недели | Phase 0 ✅ | — |
| 2 | Tokens & Autocomplete | 3-4 недели | Phase 1 ✅ | — |
| 3 | Code Connect & Inspect | 3-4 недели | Phase 2 ✅ | ↔ Phase 4 |
| 4 | Token Sync & Drift | 2-3 недели | Phase 2 ✅ | ↔ Phase 3 |
| 5 | Web & Advanced | TBD | Phase 1-3 ✅ | — |

Phase 3 и Phase 4 зависят от Phase 2, но **не друг от друга** — могут разрабатываться параллельно при наличии ресурсов.

Phase 0-3 — **core experience**: ~10-13 недель до полнофункционального расширения.
Phase 4-5 — **iterative improvements**: timeline зависит от приоритетов.
