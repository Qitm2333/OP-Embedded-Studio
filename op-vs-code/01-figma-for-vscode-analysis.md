# 01 — Figma for VS Code: анализ

## Обзор

Figma for VS Code — расширение, позволяющее разработчикам работать с дизайнами Figma прямо в VS Code. Это **cloud-first** решение: требует авторизации Figma, подключается к Figma API, работает с live-файлами.

OpenPencil — **local-first** альтернатива. Нет облака, нет аккаунтов, нет серверов. Работаем с `.fig` файлами на диске.

## Фичи Figma for VS Code

### Sidebar Panel (Inspect)
- WebviewView в Activity Bar с иконкой Figma
- Навигация по файлам/страницам/компонентам
- Выбор элемента → показ свойств (CSS, iOS, Android)
- Рендер элемента прямо в sidebar

### Code Snippets
- Выделение элемента дизайна → генерация code snippet
- Поддержка форматов: CSS, Tailwind, Swift, Kotlin, Flutter
- Вставка в код одним кликом
- Кастомные codegen плагины (Dev Mode plugins)

### Design Tokens Autocomplete
- Привязка переменных Figma (Variables API) к CSS custom properties
- Autocomplete при написании CSS/SCSS
- Color swatches рядом с токенами

### Code Connect
- Аннотация компонентов кода через специальный файл `.figma.tsx` / `.figma.vue`
- Связывает React/Vue компонент ↔ Figma компонент
- В Figma Dev Mode показывает реальный код вместо сгенерированного
- Двусторонняя навигация: из кода → в дизайн, из дизайна → в код

### Color Decorations
- Inline color preview рядом с CSS-цветами, если они совпадают с дизайн-токенами
- `DocumentColorProvider` для интеграции с VS Code color picker

### Asset Download
- Скачивание ассетов (иконки, изображения) из дизайна в репозиторий
- Конвертация форматов (SVG, PNG, PDF)

### Cursor Chat
- Real-time cursor chat с дизайнерами прямо из VS Code
- Привязка комментариев к конкретным элементам дизайна

### Real-time File Sync
- Live обновление при изменениях в Figma
- WebSocket соединение с Figma серверами
- Требует постоянного интернет-соединения

## Сравнение: Figma vs OpenPencil подход

| Аспект | Figma for VS Code | OpenPencil for VS Code |
|--------|-------------------|----------------------|
| Источник данных | Figma Cloud API | Локальные .fig файлы |
| Авторизация | Figma OAuth | Не нужна |
| Работа оффлайн | Нет | Да |
| Real-time sync | WebSocket от Figma | FileSystemWatcher |
| Cursor chat | Да (cloud) | Не применимо (local) |
| Asset download | Из облака | Из локального .fig файла |
| Design tokens | Figma Variables API | Извлечение из SceneGraph |
| Code Connect | .figma.tsx файлы | JSDoc аннотации + конфиг |
| Dev Mode plugins | Figma Plugin API | Не применимо |

## Что берём от Figma for VS Code

1. **Sidebar с деревом компонентов** — TreeDataProvider + WebviewView для превью
2. **Code snippet generation** — CSS, Tailwind из свойств SceneNode
3. **Design token autocomplete** — CompletionItemProvider для CSS/Vue/TSX
4. **Color decorations** — DocumentColorProvider для inline color swatches
5. **Code Connect** — связь между компонентами кода и дизайна (адаптировано для local-first)

## Что НЕ берём (cloud-only фичи)

1. Cursor chat — требует облако
2. Real-time collaborative editing — нет бэкенда
3. Dev Mode plugins — Figma Plugin API
4. Figma Variables API — у нас нет серверного API, токены извлекаются из .fig файла
