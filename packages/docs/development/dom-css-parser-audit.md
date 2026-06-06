# DOM/CSS parser audit

OpenPencil's DOM/CSS compatibility layer should not grow hand-rolled CSS parsing. Browser conversion should use native DOM/CSSOM and `getComputedStyle()`. Headless conversion may keep narrow approximations only as temporary test/CLI support and should prefer dependency-backed parsers or browser-oracle paths for new CSS behavior.

## Current dependency-backed pieces

- HTML parsing: `parse5` in the headless runtime, native `DOMParser` in the browser runtime.
- Stylesheet parsing: `@acemir/cssom` in the headless runtime, native CSSOM in the browser runtime.
- Tailwind generation: Tailwind v4 `compile()` / `build()`.
- Color parsing: `@open-pencil/core/color` (`culori`-backed).

## Current hand-rolled approximations

These are intentionally limited and should not be expanded without replacing them or proving a dependency cannot cover the use case.

| Area | File | Current behavior | Preferred direction |
|---|---|---|---|
| Selector matching/specificity | `packages/dom-css/src/headless-css.ts` | Supports simple tag/id/class selectors plus descendant and child combinators. Rejects pseudo/classes and attributes. | Replace with a selector engine over DesignDOM or run browser/runtime oracle for complex CSS. |
| Shorthand expansion | `packages/dom-css/src/headless-css.ts` | Expands simple margin/padding boxes, border color/width, and background color. | Use parsed declarations from CSSOM/native computed style; avoid adding new shorthand parsers. |
| `calc()` / custom properties | `packages/dom-css/src/headless-css.ts` | Resolves variables by direct lookup and only handles `calc(<number><unit> * <number>)`. | Browser runtime for real computed values; do not add arithmetic or fallback parsing manually. |
| Inline style strings | `packages/dom-css/src/style-attribute.ts`, `packages/dom-css/src/jsx/runtime.ts` | Splits simple `style="a: b;"` text into declarations. | Use native `CSSStyleDeclaration` in browser paths; keep only for simple authored test data or replace with a CSS declaration parser. |
| Shadow values | `packages/dom-css/src/css-values.ts` | Extracts one color and numeric offsets for simple shadows. | Replace with a CSS value parser before supporting multiple shadows, inset, color functions, or spread edge cases. |
| Numeric lengths | `packages/dom-css/src/css-values.ts` | Parses px/rem-ish numbers with `Number.parseFloat`. | Consume browser-computed pixel values where available; keep headless numeric parsing narrow. |

## Rule for new mapping work

- Do not add regex/string parsers for CSS grammar such as gradients, transforms, filters, complex shadows, selectors, variable fallback, or calc arithmetic.
- Prefer browser `getComputedStyle()` fixtures as oracle coverage.
- If headless support is required, first look for a maintained parser/runtime dependency and document why it was chosen.
- If a temporary approximation is unavoidable, keep it narrow, add tests that define its limits, and list it in this audit.

## Recently rejected

Linear-gradient parsing was started with manual comma/direction parsing and removed. Gradient support should be implemented only through a proper CSS value parser or browser-native extracted data that can be mapped without parsing CSS grammar manually.
