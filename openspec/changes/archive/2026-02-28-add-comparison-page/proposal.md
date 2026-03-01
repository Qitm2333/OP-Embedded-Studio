## Why

A detailed architecture and performance comparison document (`COMPARISON.md`, 277 lines) exists in the project root but is not accessible via the VitePress docs site. Users evaluating OpenPencil vs Penpot have no way to find this content through the documentation.

## What Changes

- Create `docs/guide/comparison.md` adapted from root `COMPARISON.md`
- Add sidebar and nav entry for the comparison page in VitePress config
- No source code changes

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `vitepress-docs`: add comparison page to docs site with sidebar navigation

## Impact

- `docs/.vitepress/config.ts` — new sidebar item in Guide section
- `docs/guide/comparison.md` — new documentation page
