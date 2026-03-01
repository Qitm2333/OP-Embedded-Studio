---
title: Exporting
description: Exporting images (PNG, JPG, WEBP) and saving/opening .fig files in OpenPencil.
---

# Exporting

Export individual nodes as images, or save and open entire documents as .fig files.
## Image Export

Select a node and use the Export section in the properties panel.

### Export Settings

- **Scale** — 0.5×, 0.75×, 1×, 1.5×, 2×, 3×, or 4×
- **Format** — PNG (transparent background), JPG (white background), WEBP (transparent background)

You can add multiple export settings to export the same node at different scales or formats in one go. A live preview with a checkerboard background shows what will be exported.

### Export Methods

| Method | Mac | Windows / Linux |
|--------|-----|-----------------|
| Keyboard shortcut | ⇧ ⌘ E | Shift + Ctrl + E |
| Context menu | Right-click → Export… | Right-click → Export… |
| Properties panel | Click "Export" button | Click "Export" button |

The exported file is saved via a native dialog (desktop) or browser download.

## .fig File Operations

OpenPencil uses the .fig format for full documents — the same binary format as Figma.

### Opening Files

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Open file | ⌘ O | Ctrl + O |

A file picker dialog opens, filtered for .fig files. On the desktop app, this uses the native OS dialog.

### Saving Files

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Save | ⌘ S | Ctrl + S |
| Save As | ⇧ ⌘ S | Shift + Ctrl + S |

- **Save** overwrites the currently open file without a dialog
- **Save As** opens a save dialog to choose a new location

The export pipeline encodes the scene graph to Kiwi binary format, compresses it, and writes a ZIP archive with the payload and a thumbnail image.

### Round-trip Compatibility

Files exported from OpenPencil can be opened in Figma, and vice versa. The .fig format preserves all node types, properties, fills, strokes, effects, vector data, and layout settings.

## Keyboard Shortcuts

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Export selection | ⇧ ⌘ E | Shift + Ctrl + E |
| Open file | ⌘ O | Ctrl + O |
| Save | ⌘ S | Ctrl + S |
| Save As | ⇧ ⌘ S | Shift + Ctrl + S |

## Tips

- Use 2× or 3× scale when exporting for high-DPI screens.
- JPG always uses a white background — use PNG or WEBP if you need transparency.
- The thumbnail in exported .fig files enables preview in file browsers and Figma's file picker.
