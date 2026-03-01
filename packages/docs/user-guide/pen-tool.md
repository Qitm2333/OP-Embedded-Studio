---
title: Pen Tool
description: Drawing vector paths with bezier curves using the pen tool in OpenPencil.
---

# Pen Tool

The pen tool creates vector paths using a vector network data model, compatible with Figma's .fig format.
## Activating

Press **P** to activate the pen tool.

## Placing Points

- **Click** to place a corner point (straight-line segment)
- **Click + drag** to place a curve point with bezier tangent handles — the drag direction and length control the curve shape

Click multiple points to build a path segment by segment. A preview line extends from the last placed point to your cursor as you move.

## Closing a Path

Click on the **first point** of the path to close it into a loop. Closed paths can be filled.

## Open Paths

Press **Escape** to commit the current path as an open path. Open paths render as strokes only — they're not filled.

## Vector Networks

Under the hood, paths use the vector network data model instead of simple point lists. Vector networks allow more flexible topology (e.g., branching paths) and are encoded in Figma's `vectorNetworkBlob` binary format for .fig file compatibility.

## Keyboard Shortcuts

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Pen tool | P | P |
| Commit open path | Escape | Escape |

## Tips

- The preview line always starts from the last placed point — it won't jump to (0,0).
- Drag longer when placing a curve point to make the curve wider.
- After creating a path, use the properties panel to adjust its fill, stroke, and effects.
