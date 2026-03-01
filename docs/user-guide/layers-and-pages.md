---
title: Layers & Pages
description: Managing layers, pages, and the properties panel in OpenPencil.
---

# Layers & Pages

The editor interface has three main panels: layers (left), canvas (center), and properties (right). All panels are resizable by dragging the dividers.
## Layers Panel

The layers panel on the left displays the document hierarchy as a tree.

### Tree View

Nodes are shown in a collapsible tree. Click the chevron next to a frame, group, or component to expand or collapse its children.

### Drag Reorder

Drag layers to reorder them. This changes the node's z-order in the scene graph — nodes higher in the list render on top.

### Visibility Toggle

Click the eye icon next to any layer to hide or show it on the canvas. Hidden nodes remain in the tree.

### Rename

Double-click a layer name to rename it inline.

### Selection Sync

Clicking a layer in the panel selects the corresponding node on the canvas, and vice versa.

## Pages Panel

The pages panel shows all pages in the document.

- **Switch page** — click a page tab to make it active. The canvas switches to that page and restores its viewport position.
- **Add page** — click the add button to create a new page
- **Delete page** — remove the current page
- **Rename page** — double-click the page name for inline editing. Pressing Enter or Escape, or clicking away, commits the rename.

Each page has its own canvas and viewport state.

## Properties Panel

The properties panel on the right has three tabs:

### Design Tab

Shows the properties of the selected node(s), organized in sections:

- **Appearance** — opacity, corner radius (with independent corner toggle), visibility
- **Fill** — solid color, gradients (linear, radial, angular, diamond), image fills, variable bindings
- **Stroke** — color, width, cap, join, dash pattern
- **Effects** — drop shadow, inner shadow, layer blur, background blur, foreground blur
- **Typography** — font family, size, weight, B/I/U/S formatting buttons (visible for text nodes)
- **Layout** — [auto layout](./auto-layout) controls (visible for auto-layout frames)
- **Export** — scale, format, and export button (see [Exporting](./exporting))

When no nodes are selected, the Design tab shows page-level properties including the canvas background color.

### Code Tab

Displays the selected node as JSX code with syntax highlighting, line numbers, and a copy button. Useful for exporting designs as code.

### AI Tab

An AI chat interface (also toggled with **⌘ J**) that can create and modify design elements via natural language. Supports multiple AI models through OpenRouter.

## Keyboard Shortcuts

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Toggle AI chat | ⌘ J | Ctrl + J |

## Tips

- Panel widths are saved automatically — they persist across reloads.
- Use the layers panel to find overlapping nodes that are hard to click on the canvas.
- The [context menu](./context-menu) provides additional actions for selected nodes.
- See [Selection & Manipulation](./selection-and-manipulation) for z-order shortcuts (]/[) and visibility/lock toggles.
