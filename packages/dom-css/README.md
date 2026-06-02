# @open-pencil/dom-css

DOM and CSS projection utilities for OpenPencil.

This package is the compatibility layer between OpenPencil's scene graph and DOM-shaped design documents. It is intentionally separate from `@open-pencil/core` so browser/CSS parser integrations can evolve without adding DOM dependencies to the renderer and editor core.

Current scope:

- DOM-shaped `DesignDocument` / `DesignElement` types
- Browser-backed runtime adapter for native HTML parsing, serialization, and computed-style extraction
- Headless runtime adapter with `parse5` HTML parsing and CSSOM-backed style computation for basic selectors, nested CSSOM rules, cascade order, inheritance, common shorthands, and simple custom-property/calc values
- Initial SceneGraph ⇄ DesignDOM conversion helpers for simple HTML/CSS-shaped layouts
- `compileTailwindCSS()` adapter that delegates utility compilation to Tailwind v4 and feeds the generated CSS through CSSOM

Planned scope:

- Broader SceneGraph ⇄ DesignDOM conversion
- Browser runtime parity fixtures
- Broader Tailwind compiler options for custom themes, plugins, and caller-provided stylesheet loading
