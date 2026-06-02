# @open-pencil/dom-css

DOM and CSS projection utilities for OpenPencil.

This package is the compatibility layer between OpenPencil's scene graph and DOM-shaped design documents. It is intentionally separate from `@open-pencil/core` so browser/CSS parser integrations can evolve without adding DOM dependencies to the renderer and editor core.

## Runtime model

Use the browser runtime as the high-fidelity source of truth whenever a DOM is available. It uses native parsing and `getComputedStyle()` inside an isolated sandbox:

```ts
import { createBrowserCSSRuntime } from '@open-pencil/dom-css'

const runtime = createBrowserCSSRuntime({ sandbox: 'iframe' })
const document = runtime.parseHTML('<article class="card">OpenPencil</article>')
const styled = await runtime.computeStyles(document, '.card { width: calc(10rem + 16px); }')
```

The headless runtime is useful for Bun/Node tests, CLI flows, and fast approximate conversion. It supports common selectors, inheritance, shorthands, CSSOM grouping rules, and simple variable/calc values, but it is not a browser replacement.

```ts
import { createHeadlessCSSRuntime } from '@open-pencil/dom-css'

const runtime = createHeadlessCSSRuntime()
```

## HTML/CSS to scene graph

The convenience helpers run the full pipeline:

```ts
import { htmlToSceneGraph } from '@open-pencil/dom-css'

const graph = await htmlToSceneGraph(
  '<article class="card"><h1>OpenPencil</h1></article>',
  {
    cssText: '.card { display: flex; gap: 12px; width: 320px; padding: 24px; }'
  }
)
```

For DesignDOM output without creating a scene graph, use `htmlToDesignDocument()`.

## Tailwind pipeline

Tailwind classes flow through Tailwind's own compiler, then through the CSS runtime:

```ts
import { tailwindHTMLToSceneGraph } from '@open-pencil/dom-css'

const classes = ['flex', 'w-80', 'p-6', 'rounded-xl', 'bg-white']
const graph = await tailwindHTMLToSceneGraph(
  `<article class="${classes.join(' ')}">OpenPencil</article>`,
  classes
)
```

`compileTailwindCSS()` remains available when callers want to manage runtime selection themselves.

## Current scope

- DOM-shaped `DesignDocument` / `DesignElement` types
- Browser-backed runtime adapter for native HTML parsing, serialization, and computed-style extraction
- Headless runtime adapter with `parse5` HTML parsing and CSSOM-backed style computation for basic selectors, nested CSSOM rules, cascade order, inheritance, common shorthands, and simple custom-property/calc values
- SceneGraph ⇄ DesignDOM conversion for simple HTML/CSS-shaped layouts
- Tailwind v4 compiler adapter
- Browser oracle fixtures for CSS variables, `calc()`, modern color output, and Tailwind utility output

## Roadmap

- Expand reusable fixtures: inputs, badges, nav/menu rows, dialog shells, and richer cards
- Map more computed CSS properties to scene graph fields: richer shadows, typography details, overflow, constraints, borders, and grid once OpenPencil's grid support matures
- Improve SceneGraph → CSS export so generated HTML/CSS is useful for JSX, Tailwind, and web export
- Keep `@open-pencil/dom-css` stable before splitting lower-level file-format packages such as future `@open-pencil/kiwi` and `@open-pencil/fig`
