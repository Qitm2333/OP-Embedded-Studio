---
title: Selection & Manipulation
description: Selecting, moving, resizing, rotating, duplicating, and organizing nodes in OpenPencil.
---

# Selection & Manipulation

Select objects to move, resize, rotate, duplicate, and organize them on the canvas.
## Selecting

- **Click** a node to select it (deselects everything else)
- **Shift + click** to add or remove a node from the current selection
- **Marquee drag** — drag on empty canvas to draw a selection rectangle; all intersecting nodes are selected on release
- **⌘ A** — select all nodes on the current page
- **Click empty canvas** — deselect all

## Moving

- **Drag** a selected node to move it (all selected nodes move together)
- **Arrow keys** — nudge selected nodes by 1 px
- **Shift + arrow keys** — nudge by 10 px

## Resizing

Selected nodes show 8 resize handles (4 corners + 4 edge midpoints). Drag any handle to resize.

- **Shift + drag** a corner handle to constrain proportions

## Rotating

Hover just outside a corner handle to see the rotation cursor. Drag to rotate.

- **Shift + drag** snaps rotation to 15° increments

## Duplicating

- **Alt + drag** (⌥ + drag on Mac) — duplicate the selected node and move the copy
- **⌘ D** — duplicate in place

## Deleting

Press **Backspace** or **Delete** to remove all selected nodes.

## Z-Order

Change the stacking order of nodes within their parent:

- **]** — bring to front (top of sibling list)
- **[** — send to back (bottom of sibling list)

## Visibility & Lock

- **⇧ ⌘ H** — toggle visibility. Hidden nodes don't render but stay in the layers panel.
- **⇧ ⌘ L** — toggle lock. Locked nodes can't be selected or moved on canvas.

## Move to Page

Move selected nodes to a different page via the [context menu](./context-menu). The nodes are reparented under the target page's canvas.

## Sections

Drawing a section on the canvas automatically adopts overlapping sibling nodes as children of the new section.

## Keyboard Shortcuts

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Select all | ⌘ A | Ctrl + A |
| Duplicate | ⌘ D | Ctrl + D |
| Duplicate + move | ⌥ + drag | Alt + drag |
| Delete | ⌫ / Delete | Backspace / Delete |
| Nudge 1 px | Arrow keys | Arrow keys |
| Nudge 10 px | ⇧ + Arrow keys | Shift + Arrow keys |
| Bring to front | ] | ] |
| Send to back | [ | [ |
| Toggle visibility | ⇧ ⌘ H | Shift + Ctrl + H |
| Toggle lock | ⇧ ⌘ L | Shift + Ctrl + L |

## Tips

- Use the [Layers & Pages](./layers-and-pages) panel to see and reorder nodes when they overlap.
- See [Context Menu](./context-menu) for additional actions like grouping and component creation.
