# Типы узлов

Граф сцены поддерживает 28 типов узлов из Kiwi-схемы Figma. Каждый узел идентифицируется GUID (`sessionID:localID`) и содержит ссылку на родителя через `parentIndex`. Объединение `NodeType` движка OpenPencil использует 17 из этих типов.

## Таблица типов

28 типов из схемы Figma + 1 синтетический тип движка. Типы, отмеченные ✅, входят в объединение `NodeType` движка (всего 17).

| Тип | ID | Описание | Движок |
|-----|----|----------|--------|
| DOCUMENT | 1 | Корневой узел, один на файл | — |
| CANVAS | 2 | Страница | ✅ |
| GROUP | 3 | Контейнер-группа | ✅ |
| FRAME | 4 | Основной контейнер (артборд), поддерживает auto-layout | ✅ |
| BOOLEAN_OPERATION | 5 | Результат union/subtract/intersect/exclude | |
| VECTOR | 6 | Свободный векторный путь | ✅ |
| STAR | 7 | Звезда | ✅ |
| LINE | 8 | Линия | ✅ |
| ELLIPSE | 9 | Эллипс/круг, поддерживает данные дуги | ✅ |
| RECTANGLE | 10 | Прямоугольник | ✅ |
| REGULAR_POLYGON | 11 | Правильный многоугольник (3–12 сторон, в движке используется `POLYGON`) | ✅ |
| ROUNDED_RECTANGLE | 12 | Прямоугольник со сглаженными углами | ✅ |
| TEXT | 13 | Текст с форматированием | ✅ |
| SLICE | 14 | Область экспорта | |
| SYMBOL | 15 | Компонент (основной, в движке используется `COMPONENT`) | ✅ |
| INSTANCE | 16 | Экземпляр компонента | ✅ |
| STICKY | 17 | Стикер FigJam | |
| SHAPE_WITH_TEXT | 18 | Фигура FigJam | ✅ |
| CONNECTOR | 19 | Соединительная линия между узлами | ✅ |
| CODE_BLOCK | 20 | Блок кода FigJam | |
| WIDGET | 21 | Виджет плагина | |
| STAMP | 22 | Штамп FigJam | |
| MEDIA | 23 | Видео/GIF | |
| HIGHLIGHT | 24 | Выделение FigJam | |
| SECTION | 25 | Секция холста (организационная, только верхний уровень) | ✅ |
| SECTION_OVERLAY | 26 | Оверлей секции | |
| WASHI_TAPE | 27 | Васи-тейп FigJam | |
| VARIABLE | 28 | Узел определения переменной | |
| COMPONENT_SET | — | Контейнер группы вариантов (синтетический, отображается из SYMBOL) | ✅ |

### Объединение NodeType движка (17 типов)

Движок использует упрощённые имена. Некоторые отличаются от Kiwi-схемы:
- `COMPONENT` → Kiwi `SYMBOL` (ID 15)
- `COMPONENT_SET` → контейнер группы вариантов (нет выделенного Kiwi ID, отображается из SYMBOL с вариантами)
- `POLYGON` → Kiwi `REGULAR_POLYGON` (ID 11)

```typescript
type NodeType =
  | 'CANVAS' | 'FRAME' | 'RECTANGLE' | 'ROUNDED_RECTANGLE'
  | 'ELLIPSE' | 'TEXT' | 'LINE' | 'STAR' | 'POLYGON'
  | 'VECTOR' | 'GROUP' | 'SECTION'
  | 'COMPONENT' | 'COMPONENT_SET' | 'INSTANCE'
  | 'CONNECTOR' | 'SHAPE_WITH_TEXT'
```

## Иерархия узлов

```
Document
├── Canvas (Страница 1)
│   ├── Section (только верхний уровень, плашка с названием, авто-захват соседей)
│   │   ├── Frame
│   │   │   └── ...дочерние элементы
│   │   └── Rectangle
│   ├── Frame
│   │   ├── Rectangle
│   │   ├── Text
│   │   └── Frame (вложенный)
│   │       ├── Ellipse
│   │       └── Instance (→ ссылается на Component)
│   ├── Component
│   │   └── ...дочерние элементы
│   ├── Group
│   │   └── ...дочерние элементы
│   └── BooleanOperation
│       └── ...операнды
└── Canvas (Страница 2)
    └── ...
```

## Основные свойства

Каждый узел содержит следующие поля (подмножество NodeChange):

### Идентификация и дерево

- `guid` — уникальный идентификатор (`sessionID:localID`)
- `type` — перечисление типа узла
- `name` — отображаемое имя
- `phase` — CREATED или REMOVED
- `parentIndex` — GUID родителя + строка позиции для z-упорядочивания

### Трансформация

- `size` — вектор ширины/высоты
- `transform` — аффинная матрица 2×3
- `rotation` — градусы

### Внешний вид

- `fillPaints[]` — заливки цветом/градиентом/изображением
- `strokePaints[]` — цвета обводки
- `effects[]` — тени, размытия
- `opacity` — 0–1
- `blendMode` — NORMAL, MULTIPLY, SCREEN и др.

### Обводка

- `strokeWeight` — толщина обводки
- `strokeAlign` — inside / center / outside
- `strokeCap` — butt / round / square
- `strokeJoin` — miter / bevel / round
- `dashPattern[]` — длины штрихов/промежутков

### Углы

- `cornerRadius` — единый радиус
- `cornerSmoothing` — степень сквиркла (0–1)
- Индивидуальные радиусы углов, когда `rectangleCornerRadiiIndependent` равно true

### Видимость

- `visible` — показать/скрыть
- `locked` — предотвратить редактирование

## Свойства отдельных типов

### Text

`fontSize`, `fontName`, `lineHeight`, `letterSpacing`, `textAlignHorizontal`, `textAlignVertical`, `textAutoResize`, `textData` (символы, переопределения стилей, базовые линии, глифы)

### Vector

`vectorData` (vectorNetworkBlob, normalizedSize), `fillGeometry[]`, `strokeGeometry[]`, `handleMirroring`, `arcData`

### Layout (Frame)

`stackMode`, `stackSpacing`, `stackPadding`, `stackJustify`, `stackCounterAlign`, `stackPrimarySizing`, `stackCounterSizing`, `stackChildPrimaryGrow`, `stackChildAlignSelf`

### Component

`symbolData`, `componentKey`, `componentPropDefs[]`, `symbolDescription`

### Instance

`overriddenSymbolID`, `symbolData.symbolOverrides[]`, `componentPropRefs[]`, `componentPropAssignments[]`

## Paint

```typescript
interface Fill {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' |
        'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND' | 'IMAGE'
  color: Color              // {r, g, b, a} 0–1 floats
  opacity: number           // 0–1
  visible: boolean
  blendMode?: BlendMode
  gradientStops?: GradientStop[]     // для градиентов
  gradientTransform?: GradientTransform  // матрица 2×3
  imageHash?: string        // для заливок изображением
  imageScaleMode?: 'FILL' | 'FIT' | 'CROP' | 'TILE'
  imageTransform?: GradientTransform
}
```

## Effect

```typescript
interface Effect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' |
        'BACKGROUND_BLUR' | 'FOREGROUND_BLUR'
  color: Color
  offset: { x: number; y: number }
  radius: number
  spread: number
  visible: boolean
}
```

## Stroke

```typescript
interface Stroke {
  color: Color
  weight: number
  opacity: number
  visible: boolean
  align: 'INSIDE' | 'CENTER' | 'OUTSIDE'
  cap?: 'NONE' | 'ROUND' | 'SQUARE' | 'ARROW_LINES' | 'ARROW_EQUILATERAL'
  join?: 'MITER' | 'BEVEL' | 'ROUND'
  dashPattern?: number[]
}
```
