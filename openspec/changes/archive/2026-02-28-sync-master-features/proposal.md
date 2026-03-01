## Why

13 commits merged from master introduce components/instances, context menu, z-order, visibility/lock, move-to-page, viewport culling, and rendering optimizations. The openspec specs and VitePress docs don't reflect these new capabilities. The Figma Feature Matrix also needs status updates.

## What Changes

- Update specs to cover: components (create, instance, detach, go-to-main, component sets), context menu, z-order (bring to front/send to back), visibility toggle, lock/unlock, move-to-page, rename node, viewport culling, rendering optimizations (RAF coalescing, paint reuse)
- Update `docs/guide/features.md` with new features
- Update `docs/guide/figma-comparison.md` statuses (components partial, z-order ✅, lock/visibility ✅, rename ✅, context menu ✅)
- Update `docs/reference/keyboard-shortcuts.md` with newly implemented shortcuts
- Update `docs/development/roadmap.md` — Phase 4 partially started

## Capabilities

### New Capabilities
- `components`: Components, component sets, instances — create, instantiate, detach, go-to-main component, component labels
- `context-menu`: Right-click context menu with clipboard, z-order, grouping, component, visibility, lock, and move-to-page actions

### Modified Capabilities
- `scene-graph`: New methods — cloneTree, createInstance, detachInstance, getMainComponent, getInstances, hitTestDeep; componentId/overrides fields on SceneNode
- `canvas-rendering`: Viewport culling, component label rendering, component set dashed border, Paint reuse, RAF coalescing
- `selection-manipulation`: Components/instances are opaque containers (click selects whole, double-click enters); z-order (bring to front, send to back); toggle visibility; toggle lock; move to page; rename node
- `editor-ui`: Context menu integration, component keyboard shortcuts (⌥⌘K, ⌥⌘B, ⇧⌘K), z-order shortcuts (], [), visibility (⇧⌘H), lock (⇧⌘L)
- `vitepress-docs`: Update features, keyboard shortcuts, roadmap, figma comparison pages
- `figma-comparison-docs`: Status updates for newly implemented features

## Impact

- `openspec/specs/` — 2 new specs, 6 modified specs
- `docs/` — 4 pages updated (features, keyboard-shortcuts, roadmap, figma-comparison)
- No source code changes — specs and docs sync only
