# `open-pencil eval` — Figma-совместимый Plugin API для скриптинга без GUI

## Обзор

`bun open-pencil eval <file> --code '<js>'` выполняет JavaScript-код над `.fig`-файлом с глобальным объектом `figma`, совместимым с Figma. Это позволяет автоматизировать пакетные операции, запускать AI-инструменты и тесты — всё без графического интерфейса.

Объект `figma` максимально точно повторяет API плагинов Figma, поэтому существующие знания и фрагменты кода для плагинов Figma можно использовать напрямую.

```bash
# Создать фрейм, настроить автораскладку, добавить дочерние элементы
bun open-pencil eval design.fig --code '
  const frame = figma.createFrame()
  frame.name = "Card"
  frame.resize(300, 200)
  frame.layoutMode = "VERTICAL"
  frame.itemSpacing = 12
  frame.paddingTop = frame.paddingBottom = 16
  frame.paddingLeft = frame.paddingRight = 16
  frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }]

  const title = figma.createText()
  title.characters = "Hello World"
  title.fontSize = 24
  frame.appendChild(title)

  return { id: frame.id, name: frame.name }
'

# Поиск узлов
bun open-pencil eval design.fig --code '
  const buttons = figma.currentPage.findAll(n => n.type === "FRAME" && n.name.includes("Button"))
  return buttons.map(b => ({ id: b.id, name: b.name, w: b.width, h: b.height }))
'

# Чтение из stdin (для многострочных скриптов / пайплайнов)
cat transform.js | bun open-pencil eval design.fig --stdin

# Сохранить изменения обратно в файл
bun open-pencil eval design.fig --code '...' --write
bun open-pencil eval design.fig --code '...' -o modified.fig
```

## Архитектура

```
┌──────────────────────────────────────────────────────┐
│  CLI: `open-pencil eval <file> --code '...'`         │
│    ↓                                                 │
│  loadDocument(file) → SceneGraph                     │
│    ↓                                                 │
│  FigmaAPI(sceneGraph) → прокси-объект `figma`        │
│    ↓                                                 │
│  AsyncFunction('figma', wrappedCode)(figmaProxy)     │
│    ↓                                                 │
│  вывод результата в JSON / agentfmt                  │
│  опционально: saveDocument(file) при --write         │
└──────────────────────────────────────────────────────┘
```

### Основные классы

| Класс | Расположение | Роль |
|-------|--------------|------|
| `FigmaAPI` | `packages/core/src/figma-api.ts` | Прокси-объект, реализующий методы `figma.*` поверх `SceneGraph` |
| `FigmaNode` | `packages/core/src/figma-api.ts` | Прокси-обёртка над `SceneNode` с доступом к свойствам в стиле Figma (`.fills`, `.resize()`, `.appendChild()` и т.д.) |
| Команда `eval` | `packages/cli/src/commands/eval.ts` | CLI-команда, загружающая документ, создающая API и выполняющая код |

### Почему в `@open-pencil/core`?

Класс `FigmaAPI` находится в core (а не в CLI), потому что:
- **AI-инструменты используют его** — инструмент `render` в панели чата выполняет JSX через тот же API
- **Тестовые скрипты** — модульные тесты могут использовать API для подготовки фикстур
- **Нет зависимостей от DOM** — работает в headless-режиме в Bun, без браузерных API

## `FigmaAPI` — поэтапная реализация

### Фаза 1: Базовый функционал (MVP для команды eval)

Покрывает ~80% реальных скриптов для плагинов:

#### Документ и страницы

| Figma API | Наша реализация | Примечания |
|-----------|-----------------|------------|
| `figma.root` | Геттер → прокси для корневого узла | `.children` возвращает прокси страниц |
| `figma.currentPage` | Геттер/сеттер → первая страница по умолчанию | Можно установить на любой прокси страницы |
| `figma.currentPage.selection` | Чтение/запись → отслеживаемый массив выделения | |
| `figma.getNodeById(id)` | `graph.getNode(id)`, обёрнутый в прокси | Синхронный, как устаревшая версия Figma |

#### Создание узлов

| Figma API | Соответствие |
|-----------|--------------|
| `figma.createFrame()` | `graph.createNode('FRAME', currentPageId)` |
| `figma.createRectangle()` | `graph.createNode('RECTANGLE', ...)` |
| `figma.createEllipse()` | `graph.createNode('ELLIPSE', ...)` |
| `figma.createText()` | `graph.createNode('TEXT', ...)` |
| `figma.createLine()` | `graph.createNode('LINE', ...)` |
| `figma.createPolygon()` | `graph.createNode('POLYGON', ...)` |
| `figma.createStar()` | `graph.createNode('STAR', ...)` |
| `figma.createComponent()` | `graph.createNode('COMPONENT', ...)` |
| `figma.createPage()` | `graph.addPage(name)` |
| `figma.createSection()` | `graph.createNode('SECTION', ...)` |

#### Свойства узлов (через прокси `FigmaNode`)

Чтение и запись на любом прокси-узле. Обращение к свойствам транслируется в поля `SceneNode`:

```ts
// Геометрия
node.x, node.y              // прямое соответствие
node.width, node.height      // только чтение, используйте node.resize(w, h)
node.rotation                // прямое соответствие
node.resize(w, h)            // обновляет width и height
node.resizeWithoutConstraints(w, h) // аналогично (движка ограничений пока нет)

// Визуальные свойства
node.fills                   // чтение/запись Fill[]
node.strokes                 // чтение/запись Stroke[]
node.effects                 // чтение/запись Effect[]
node.opacity                 // чтение/запись number
node.visible                 // чтение/запись boolean
node.locked                  // чтение/запись boolean
node.blendMode               // чтение/запись BlendMode
node.clipsContent            // чтение/запись boolean

// Скругление углов
node.cornerRadius            // чтение/запись (number или figma.mixed)
node.topLeftRadius           // чтение/запись
node.topRightRadius          // чтение/запись
node.bottomLeftRadius        // чтение/запись
node.bottomRightRadius       // чтение/запись
node.cornerSmoothing         // чтение/запись

// Идентификация
node.id                      // только чтение
node.name                    // чтение/запись
node.type                    // только чтение
node.parent                  // только чтение → FigmaNode | null
node.removed                 // только чтение boolean
```

#### Операции с деревом

```ts
node.children                // только чтение FigmaNode[]
node.appendChild(child)      // перемещает в конец
node.insertChild(index, child) // перемещает на позицию index
node.remove()                // graph.deleteNode(id)

// Обход дерева
node.findAll(callback?)      // рекурсивный поиск
node.findOne(callback)       // первое совпадение
node.findChild(callback)     // только среди прямых потомков
node.findChildren(callback?) // только среди прямых потомков
```

#### Автораскладка

```ts
node.layoutMode              // 'NONE' | 'HORIZONTAL' | 'VERTICAL'
node.primaryAxisAlignItems   // 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'
node.counterAxisAlignItems   // 'MIN' | 'CENTER' | 'MAX' | 'BASELINE'
node.itemSpacing             // number
node.counterAxisSpacing      // number | null
node.paddingTop / Right / Bottom / Left  // number
node.layoutWrap              // 'NO_WRAP' | 'WRAP'

// Размеры дочерних элементов
node.layoutPositioning       // 'AUTO' | 'ABSOLUTE'
node.layoutGrow              // 0 | 1
node.layoutSizingHorizontal  // 'FIXED' | 'HUG' | 'FILL'
node.layoutSizingVertical    // 'FIXED' | 'HUG' | 'FILL'
```

#### Текст

```ts
node.characters              // чтение/запись (соответствует node.text)
node.fontSize                // чтение/запись
node.fontName                // чтение/запись { family, style }
node.fontWeight              // чтение/запись
node.textAlignHorizontal     // чтение/запись
node.textAlignVertical       // чтение/запись
node.textAutoResize          // чтение/запись
node.letterSpacing           // чтение/запись
node.lineHeight              // чтение/запись
node.maxLines                // чтение/запись
node.textCase                // чтение/запись
node.textDecoration          // чтение/запись
```

#### Параметры обводки

```ts
node.strokeWeight            // чтение/запись (соответствует strokes[0].weight)
node.strokeAlign             // чтение/запись (соответствует strokes[0].align)
node.dashPattern             // чтение/запись
```

#### Прочее

```ts
figma.mixed                  // Symbol-маркер для смешанных значений
figma.group(nodes, parent)   // создаёт GROUP с указанными дочерними элементами
figma.ungroup(node)          // разгруппировывает, перемещает потомков к родителю
figma.flatten(nodes)         // ПОКА НЕ РЕАЛИЗОВАНО — возвращает первый узел
```

#### Экспорт

```ts
node.exportAsync(settings?)  // работает только при загруженном CanvasKit
                             // settings: { format: 'PNG'|'JPG'|'SVG', constraint? }
```

### Фаза 2: Компоненты и экземпляры

| API | Соответствие |
|-----|--------------|
| `figma.createComponent()` | `graph.createNode('COMPONENT', ...)` |
| `figma.createComponentFromNode(node)` | Преобразование существующего фрейма в компонент |
| `figma.combineAsVariants(components, parent)` | Создание COMPONENT_SET |
| Узел: `node.createInstance()` | `graph.createInstance(componentId, parentId)` |
| Узел: `node.detachInstance()` | `graph.detachInstance(id)` |
| `figma.getNodeById(id).mainComponent` | `graph.getMainComponent(id)` |

### Фаза 3: Переменные

| API | Соответствие |
|-----|--------------|
| `figma.variables.getLocalVariables(type?)` | `graph.variables` с фильтрацией |
| `figma.variables.getLocalVariableCollections()` | `graph.variableCollections` |
| `figma.variables.createVariable(name, collection, type)` | `graph.addVariable(...)` |
| `figma.variables.createVariableCollection(name)` | `graph.addCollection(...)` |
| `figma.variables.getVariableById(id)` | `graph.variables.get(id)` |
| `node.setBoundVariable(field, variable)` | `graph.bindVariable(...)` |
| `node.boundVariables` | Геттер из SceneNode |

### Фаза 4: Стили и расширенные возможности

| API | Примечания |
|-----|------------|
| `figma.createPaintStyle()` | Требует хранилища стилей в SceneGraph |
| `figma.createTextStyle()` | Требует хранилища стилей в SceneGraph |
| `figma.createEffectStyle()` | Требует хранилища стилей в SceneGraph |
| `figma.loadFontAsync(fontName)` | No-op (у нас нет ограничений на загрузку шрифтов) |
| `figma.listAvailableFontsAsync()` | Возвращает системные шрифты, если доступны |
| Булевы операции (`union`, `subtract`, `intersect`, `exclude`) | Требует движка булевых операций над путями |
| `figma.createNodeFromJSXAsync(jsx)` | Портирование JSX-рендерера из figma-use |

## Устройство прокси `FigmaNode`

Прокси оборачивает `SceneNode` и транслирует имена свойств Figma во внутренние имена. Основные соответствия:

```ts
const PROPERTY_MAP: Record<string, string> = {
  // Имя Figma → поле SceneNode (только при различиях)
  'characters': 'text',
  'strokeWeight': → вычисляется из strokes[0].weight,
  'strokeAlign': → вычисляется из strokes[0].align,
  'fontName': → вычисляется из { family: fontFamily, style: ... },
  'primaryAxisAlignItems': 'primaryAxisAlign',
  'counterAxisAlignItems': 'counterAxisAlign',
  'primaryAxisSizingMode': 'primaryAxisSizing',    // маппинг значений: 'AUTO' → 'HUG', 'FIXED' → 'FIXED'
  'counterAxisSizingMode': 'counterAxisSizing',
  'layoutSizingHorizontal': → вычисляется из primaryAxisSizing / counterAxisSizing в зависимости от layoutMode
  'layoutSizingVertical': → вычисляется
}
```

Методы прокси:

```ts
class FigmaNode {
  // Прокси создаётся через: new Proxy(target, handler)
  // handler.get перехватывает чтение свойств, handler.set — запись

  resize(width: number, height: number): void
  resizeWithoutConstraints(width: number, height: number): void
  remove(): void
  appendChild(child: FigmaNode): void
  insertChild(index: number, child: FigmaNode): void
  findAll(callback?: (node: FigmaNode) => boolean): FigmaNode[]
  findOne(callback: (node: FigmaNode) => boolean): FigmaNode | null
  findChild(callback: (node: FigmaNode) => boolean): FigmaNode | null
  findChildren(callback?: (node: FigmaNode) => boolean): FigmaNode[]
  exportAsync(settings?: ExportSettings): Promise<Uint8Array>

  // Компоненты (Фаза 2)
  createInstance(): FigmaNode
  detachInstance(): void
  get mainComponent(): FigmaNode | null
}
```

## CLI-команда

```
bun open-pencil eval <file> [options]

Аргументы:
  file            .fig-файл для обработки

Опции:
  --code, -c      JavaScript-код для выполнения (имеет доступ к глобальному объекту `figma`)
  --stdin         Читать код из stdin вместо --code
  --write, -w     Записать изменения обратно в исходный файл
  -o, --output    Записать в другой файл
  --json          Вывести результат в формате JSON (по умолчанию для не-TTY)
  --quiet, -q     Подавить вывод, только записать файл
```

### Модель выполнения

1. Загрузка `.fig` → `SceneGraph`
2. Создание `FigmaAPI(graph)` → прокси `figma`
3. Обёртка пользовательского кода в асинхронную функцию: `return (async () => { <код> })()`
4. Выполнение с `figma` в качестве единственного аргумента
5. Вывод возвращённого значения (JSON или agentfmt)
6. Если указан `--write` или `-o`: сериализация `SceneGraph` обратно в `.fig`

### Форматирование возвращаемого значения

- `undefined` / `void` → без вывода
- Примитивы → выводятся напрямую
- Объекты/массивы → `JSON.stringify(result, null, 2)` или таблицы agentfmt
- `FigmaNode` → сериализуется как `{ id, type, name, x, y, width, height, fills, ... }`
- Массивы `FigmaNode` → сериализуются как список

## Общий код с AI-инструментами

Класс `FigmaAPI` — это **та же поверхность API**, которую используют AI-инструменты. Сейчас `src/ai/tools.ts` вызывает `store.createShape()`, `store.updateNodeWithUndo()` и т.д. — их следует рефакторить для работы через `FigmaAPI`:

```ts
// До (текущие AI-инструменты)
execute: async ({ type, x, y, width, height }) => {
  const id = store.createShape(type, x, y, width, height)
  return { id }
}

// После (с использованием FigmaAPI)
execute: async ({ type, x, y, width, height }) => {
  const frame = figma.createFrame()
  frame.resize(width, height)
  frame.x = x
  frame.y = y
  return { id: frame.id }
}
```

Это гарантирует идентичное поведение CLI-скриптов и AI-инструментов.

## Структура файлов

```
packages/core/src/
  figma-api.ts          # Класс FigmaAPI + прокси FigmaNode (Фазы 1–4)
  figma-api.test.ts     # Модульные тесты на headless SceneGraph

packages/cli/src/commands/
  eval.ts               # CLI-команда

packages/cli/src/commands/eval.test.ts  # Интеграционные тесты
```

## План тестирования

### Модульные тесты (`packages/core/src/figma-api.test.ts`)

1. **Создание узлов** — каждый `createX()` создаёт узел правильного типа, добавленный на текущую страницу
2. **Доступ к свойствам** — `.fills`, `.x`, `.width`, `.name`, `.characters` корректно читаются и записываются
3. **Изменение размера** — `.resize(w, h)` обновляет width/height
4. **Операции с деревом** — `.appendChild()`, `.insertChild()`, `.remove()`, `.parent`, `.children`
5. **Обход дерева** — `.findAll()`, `.findOne()`, `.findChild()`, `.findChildren()` с колбэками
6. **Автораскладка** — `.layoutMode`, `.itemSpacing`, `.paddingTop` и т.д.
7. **Текст** — `.characters` соответствует `.text`, `.fontName` соответствует `{ family, style }`
8. **Смешанные значения** — `.cornerRadius` возвращает `figma.mixed`, когда углы различаются
9. **Выделение** — `figma.currentPage.selection` чтение/запись
10. **Переключение страниц** — `figma.currentPage = page2` работает
11. **Группировка/разгруппировка** — `figma.group()` создаёт группу, `figma.ungroup()` расформировывает её
12. **Клонирование** — создание узлов порождает независимые копии

### Интеграционные тесты CLI (`packages/cli/src/commands/eval.test.ts`)

1. **Базовый eval** — `eval test.fig --code 'return figma.currentPage.name'` → имя страницы
2. **Создание + чтение** — создать фрейм, вернуть его свойства
3. **Поиск узлов** — `findAll` возвращает правильные узлы
4. **Сохранение** — `--write` сохраняет изменения, при повторной загрузке они видны
5. **Stdin** — `echo 'return 42' | bun open-pencil eval test.fig --stdin` → `42`
6. **JSON-вывод** — `--json` возвращает валидный JSON
7. **Обработка ошибок** — синтаксические и ошибки времени выполнения корректно выводятся

## Порядок реализации

1. **Прокси `FigmaNode`** — маппинг свойств, `.resize()`, `.remove()`, методы работы с деревом
2. **Класс `FigmaAPI`** — `createFrame/Rectangle/...`, `.root`, `.currentPage`, `.getNodeById()`, `.mixed`, `.group()`
3. **CLI-команда `eval`** — разбор аргументов, обёртка кода, форматирование вывода
4. **Модульные тесты** — все 12 групп тестов выше
5. **Интеграционные тесты CLI** — все 7 групп тестов выше
6. **Интеграция с AI-инструментами** — рефакторинг `src/ai/tools.ts` для использования `FigmaAPI` где возможно
7. **Фаза 2** — компоненты и экземпляры
8. **Фаза 3** — переменные
9. **Фаза 4** — стили, булевы операции, JSX-рендерер

## Справочник соответствий свойств

| Свойство Figma | Поле SceneNode | Тип | Примечания |
|----------------|----------------|-----|------------|
| `characters` | `text` | `string` | |
| `fontName` | `fontFamily` + `fontWeight` + `italic` | `{ family, style }` | Вычисляется: `style` = "Bold Italic" и т.д. |
| `strokeWeight` | `strokes[0].weight` | `number` | Вычисляется |
| `strokeAlign` | `strokes[0].align` | `string` | Вычисляется |
| `primaryAxisAlignItems` | `primaryAxisAlign` | `string` | |
| `counterAxisAlignItems` | `counterAxisAlign` | `string` | |
| `layoutSizingHorizontal` | `primaryAxisSizing` или `counterAxisSizing` | `string` | Зависит от `layoutMode` |
| `layoutSizingVertical` | (противоположное horizontal) | `string` | |
| `absoluteTransform` | вычисляется из `x`, `y`, `rotation` | `Transform` | Только чтение |
| `absoluteBoundingBox` | `getAbsoluteBounds(id)` | `Rect` | Только чтение |
| Все остальные | Совпадающее имя | Тот же тип | Прямая передача |

## Открытые вопросы

1. **Загрузка шрифтов**: `figma.loadFontAsync()` — должно ли быть no-op (у нас нет ограничений на шрифты) или нужно отслеживать загруженные шрифты?
   → **Решение: No-op, возвращающий resolved Promise.** Мы не блокируем редактирование текста загрузкой шрифтов.

2. **Экспорт в headless-режиме**: `node.exportAsync()` требует CanvasKit. Должен ли eval загружать CanvasKit?
   → **Решение: Опционально.** Если CanvasKit доступен (через флаг `--with-canvaskit` или переменную окружения), экспорт включается. Иначе выбрасывается ошибка "Export requires CanvasKit".

3. **Символ `figma.mixed`**: Использовать настоящий символ Figma или собственный?
   → **Решение: Собственный `Symbol('mixed')`.** Доступен как `figma.mixed`.

4. **Отмена действий**: `figma.commitUndo()` / `figma.triggerUndo()` — актуально ли в headless-режиме?
   → **Решение: No-op в CLI.** Отмена имеет значение только в интерактивном редакторе. AI-инструменты могут добавить поддержку отмены отдельно через EditorStore.

5. **Формат записи**: Должен ли `--write` создавать `.fig` (бинарный Kiwi) или также поддерживать `.json`?
   → **Решение: Только `.fig` на данный момент.** Экспорт в JSON — отдельная функциональность.
