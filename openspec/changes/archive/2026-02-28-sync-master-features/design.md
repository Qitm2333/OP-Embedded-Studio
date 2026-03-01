## Context

13 commits from master added components/instances, context menu, and rendering optimizations. The docs branch has specs and VitePress docs that predate these features. This change synchronizes documentation artifacts with the actual codebase state.

## Goals / Non-Goals

**Goals:**
- All new capabilities have corresponding spec requirements and scenarios
- VitePress docs accurately reflect current feature set
- Figma Feature Matrix reflects the new status of implemented features

**Non-Goals:**
- No source code changes
- Not adding specs for low-level implementation details (RAF coalescing, paint reuse are perf optimizations, not user-facing requirements)

## Decisions

### 1. Two new specs: `components` and `context-menu`

Components are a major feature area deserving their own spec. Context menu is a distinct UI capability with its own action set.

### 2. Viewport culling goes into `canvas-rendering` as a modified requirement

Culling changes rendering behavior (off-screen nodes are skipped) so it modifies the rendering spec.

### 3. Keyboard shortcuts documented in `editor-ui` spec, not a separate spec

The shortcuts are part of the editor UI, consistent with existing pattern where `editor-ui` covers keyboard interactions for tools and panels.
