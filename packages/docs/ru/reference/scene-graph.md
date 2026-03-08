# Граф сцены

## Представление в памяти

Узлы хранятся в плоском `Map<string, Node>` с ключами-GUID. Древовидная структура поддерживается через ссылки `parentIndex`. Это обеспечивает O(1) поиск по ID и эффективный обход.

```typescript
interface SceneGraph {
  nodes: Map<string, Node>
  root: string

  getNode(id: string): Node
  getChildren(id: string): Node[]
  getParent(id: string): Node | null
  getPages(): Node[]

  createNode(type: NodeType, parent: string, props: Partial<NodeChange>): Node
  updateNode(id: string, changes: Partial<NodeChange>): void
  deleteNode(id: string): void
  moveNode(id: string, newParent: string, position: string): void
  addPage(name: string): Node
  deletePage(id: string): void
  renamePage(id: string, name: string): void

  findByType(type: NodeType): Node[]
  findByName(pattern: string): Node[]
  hitTest(point: Vector, canvas: string): Node | null
  getNodesInRect(rect: Rect, canvas: string): Node[]
}
```

## Страницы

Документы поддерживают несколько страниц (узлы CANVAS как прямые потомки корня DOCUMENT). Каждая страница имеет собственное дерево дочерних элементов и независимое состояние области просмотра (panX, panY, zoom, pageColor). Редактор отслеживает `currentPageId` и отрисовывает только дочерние элементы активной страницы.

## Секции

Узлы SECTION — это организационные контейнеры верхнего уровня (только прямые потомки CANVAS). Они не могут вкладываться во фреймы или группы. Создание секции автоматически захватывает перекрывающихся соседей. Секции отображают плашку с заголовком, цвет текста которой адаптируется в зависимости от яркости фона.

## Состояние наведения

Состояние редактора отслеживает `hoveredNodeId` — узел, находящийся под курсором. Отрисовщик рисует контур наведения, повторяющий форму объекта (по фактической геометрии для эллипсов, скруглённых прямоугольников, векторов), для визуальной обратной связи перед выделением.

## Отмена/повтор

Система использует паттерн **обратных команд** Figma. Каждая запись отмены содержит прямые изменения и их автоматически вычисленную инверсию:

| Операция | Прямое действие | Обратное действие |
|----------|-----------------|-------------------|
| Создание узла | `{guid, phase: CREATED, ...props}` | `{guid, phase: REMOVED}` |
| Удаление узла | `{guid, phase: REMOVED}` | `{guid, phase: CREATED, ...allProps}` |
| Изменение свойства | `{guid, fill: "#F00"}` | `{guid, fill: "#00F"}` |
| Перемещение узла | `{guid, parentIndex: newParent}` | `{guid, parentIndex: oldParent}` |

Перед применением любого изменения создаётся снимок затронутых полей. Этот снимок становится обратным действием.

**Группировка** — такие операции, как перетаскивание, генерируют сотни изменений позиции в секунду. Они объединяются в одну запись отмены с помощью дебаунса. `beginBatch`/`commitBatch` оборачивает многоступенчатые операции.

## Движок компоновки (Yoga)

Свойства auto-layout Figma отображаются на Yoga flexbox:

| Свойство Figma | Эквивалент Yoga |
|---|---|
| `stackMode: HORIZONTAL` | `flexDirection: row` |
| `stackMode: VERTICAL` | `flexDirection: column` |
| `stackSpacing` | `gap` |
| `stackPadding` | `padding` |
| `stackJustify: MIN/CENTER/MAX/SPACE_BETWEEN` | `justifyContent` |
| `stackCounterAlign` | `alignItems` |
| `stackPrimarySizing: FIXED/HUG/FILL` | width/height + flex-grow |
| `stackChildPrimaryGrow` | `flexGrow` |
| `stackChildAlignSelf` | `alignSelf` |
| `stackPositioning: ABSOLUTE` | `position: absolute` |

## Проверка попадания (Hit Testing)

Для заданной точки в координатах холста граф сцены возвращает самый верхний видимый узел в этой позиции. Алгоритм:

1. Обход видимых узлов в обратном z-порядке (сверху вниз)
2. Преобразование точки проверки в локальную систему координат каждого узла
3. Проверка, находится ли точка в пределах границ узла (с учётом поворота)
4. Возврат первого совпадения

Для выделения рамкой `getNodesInRect` возвращает все узлы, чьи границы пересекаются с заданным прямоугольником.

## Расширенные типы заливок

Заливки поддерживают шесть типов: SOLID, GRADIENT_LINEAR, GRADIENT_RADIAL, GRADIENT_ANGULAR, GRADIENT_DIAMOND и IMAGE. Градиентные заливки содержат `gradientStops` (пары цвет + позиция) и `gradientTransform` (матрица 2×3). Заливки изображением ссылаются на бинарные данные через `imageHash` с режимами масштабирования (FILL, FIT, CROP, TILE).

## Расширенные свойства обводки

Обводки поддерживают `cap` (NONE, ROUND, SQUARE, ARROW_LINES, ARROW_EQUILATERAL), `join` (MITER, BEVEL, ROUND) и `dashPattern` (массив длин штрихов/промежутков) в дополнение к базовым свойствам color, weight, opacity, visible и align.

## Система координат

Узлы хранят позицию и размер относительно родителя. Чтобы получить абсолютные (холстовые) координаты, нужно пройти вверх по цепочке родителей, применяя трансформации. Отрисовщик использует это для корректного позиционирования вложенных фреймов.

Поворот хранится в градусах и применяется как часть аффинной матрицы 2×3. Направляющие привязки и проверка попадания учитывают поворот при вычислении визуальных границ.
