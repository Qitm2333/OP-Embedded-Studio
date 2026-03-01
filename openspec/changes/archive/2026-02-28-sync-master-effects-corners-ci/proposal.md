# Proposal: Sync Master Features into Specs & Docs

## Context

10 commits merged from master since last docs/specs sync (68425a0..af3db9f). These introduce significant new features that are not yet reflected in OpenSpec specs, VitePress docs, or the Figma comparison matrix.

## New Features to Document

1. **Live component-instance sync** — editing a main component propagates changes to all instances. Instance children mapped via `componentId`. Override record preserves instance-level customizations.
2. **Independent corner radius controls** — per-corner radius UI in Appearance section with toggle for uniform/independent mode.
3. **Effects section in properties panel** — full effects panel: add/remove effects, type picker, inline controls.
4. **GitHub Actions CI/CD** — build workflow for Windows + macOS.
5. **Mac shortcut fixes** — ⌥⌘K/⌥⌘B/⇧⌘K/⇧⌘H/⇧⌘L.
6. **Instance tests** — unit tests for sync lifecycle.
