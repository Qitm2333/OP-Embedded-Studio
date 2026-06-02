# @open-pencil/dom-css

DOM and CSS projection utilities for OpenPencil.

This package is the compatibility layer between OpenPencil's scene graph and DOM-shaped design documents. It is intentionally separate from `@open-pencil/core` so browser/CSS parser integrations can evolve without adding DOM dependencies to the renderer and editor core.

Current scope:

- DOM-shaped `DesignDocument` / `DesignElement` types
- Browser-backed runtime adapter for native HTML parsing, serialization, and computed-style extraction
- Headless runtime placeholder for future `parse5` / CSSOM-backed execution

Planned scope:

- SceneGraph ⇄ DesignDOM conversion
- CSSOM and cascade support in headless contexts
- Tailwind-generated CSS ingestion
