# OpenPencil for VS Code — Исследование и план

Исследовательский документ по созданию VS Code расширения для OpenPencil — аналога Figma for VS Code.

## Цель

Интегрировать OpenPencil в VS Code, чтобы разработчики могли:
- Просматривать .fig файлы из дизайна прямо в редакторе
- Подтягивать стили (цвета, типографику, spacing) в код через autocomplete
- Навигировать между кодом и дизайном
- Копировать CSS/Tailwind из дизайн-элементов

## Навигация

| # | Документ | Содержание |
|---|----------|-----------|
| 01 | [Figma for VS Code Analysis](01-figma-for-vscode-analysis.md) | Что делает Figma for VS Code — полный разбор фич, cloud vs local |
| 02 | [OpenPencil Reuse Audit](02-openpencil-reuse-audit.md) | Какие модули OpenPencil переиспользуемы в extension — верифицированный import-граф |
| 03 | [VS Code API Integration](03-vscode-api-integration.md) | Точки интеграции с VS Code Extension API |
| 04 | [Architecture](04-architecture.md) | Архитектура расширения, communication protocol, config schema |
| 05 | [Roadmap](05-roadmap.md) | Фазированный план реализации с Phase 0 PoC spike |

## Ключевые выводы

1. **CanvasKit WASM работает в VS Code webview** — подтверждено примерами: [pixcil](https://github.com/sile/pixcil) (WASM image editor), [crabviz](https://github.com/chanhx/crabviz) (WASM graph viz), [matterviz](https://github.com/janosh/matterviz) (WebGL 3D viewer). Требуется CSP `'wasm-unsafe-eval'` + `'nonce-...'`.

2. **Engine-код OpenPencil полностью переиспользуем** — `src/engine/` и `src/kiwi/` не имеют Vue-зависимостей. Импортируют только `@/types`, `culori`, `canvaskit-wasm`, `fflate`, `fzstd`, `yoga-layout`.

3. **Local-first vs Cloud-first** — Figma for VS Code подключается к облаку через API. OpenPencil работает с локальными .fig файлами. Это упрощает архитектуру (нет auth, нет API, нет real-time sync), но ограничивает collaborative сценарии.

4. **Монорепо-рефакторинг не обязателен** — engine-код можно подключить в extension через esbuild alias без перестройки основного проекта.

5. **Scope: Desktop VS Code only** на старте. VS Code Web (vscode.dev) отложен — CanvasKit WASM ~5MB и WebGL не гарантированы в browser context.
