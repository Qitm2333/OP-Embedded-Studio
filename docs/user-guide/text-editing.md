---
title: Text Editing
description: Creating and editing text with rich formatting, fonts, and inline editing in OpenPencil.
---

# Text Editing

Create text nodes and edit them directly on the canvas with full rich text support.
## Creating Text

Press **T** to activate the text tool, then click on the canvas. An empty text node appears with a blinking cursor — start typing immediately.

## Inline Editing

Double-click any existing text node to enter inline editing mode. A blue outline appears around the text to indicate edit mode. Click outside the text node to commit and exit editing.

Text is rendered directly on the canvas using CanvasKit's Paragraph API — there's no visible text input overlay.

## Cursor Navigation

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Move left/right | ← / → | ← / → |
| Move up/down | ↑ / ↓ | ↑ / ↓ |
| Move by word | ⌥ ← / ⌥ → | Ctrl + ← / Ctrl + → |
| Move to line start/end | ⌘ ← / ⌘ → | Home / End |

Hold **Shift** with any movement key to extend the selection.

## Text Selection

- **Click** inside a text node to position the cursor
- **Click + drag** to select a range of text
- **Double-click** a word to select it
- **Triple-click** to select all text in the node

## Rich Text Formatting

Apply formatting to selected text, or toggle the style for the entire node when nothing is selected.

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Bold | ⌘ B | Ctrl + B |
| Italic | ⌘ I | Ctrl + I |
| Underline | ⌘ U | Ctrl + U |

Strikethrough is available via the **S** toggle button in the Typography section of the properties panel (no keyboard shortcut — ⌘ S is used for Save).

Formatting is stored as style runs (per-character styles). When you type between a bold and regular segment, the new text inherits the style of the preceding segment.

The **B / I / U / S** toggle buttons in the Typography section of the properties panel also apply formatting.

## Editing Operations

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Delete word before cursor | ⌥ ⌫ | Ctrl + Backspace |
| Delete to line start | ⌘ ⌫ | — |
| Cut | ⌘ X | Ctrl + X |
| Copy | ⌘ C | Ctrl + C |
| Paste | ⌘ V | Ctrl + V |

## Font Picker

Open the font picker in the Typography section of the properties panel to change the font family. The picker features:

- **Search filter** — type to narrow the font list
- **Font preview** — each font name is rendered in its own typeface
- **Virtual scroll** — handles large font lists efficiently
- **Scroll-to-current** — the current font is highlighted when the picker opens

## Font Weight

Change the font weight in the Typography section of the properties panel. Available weights depend on the selected font family (e.g., Regular, Medium, Bold, Black). The weight is applied per-node and renders via CanvasKit text styles.

## Font Sources

- **Default font** — Inter is loaded automatically
- **Desktop (Tauri)** — system fonts are enumerated via the font-kit Rust backend and preloaded on startup
- **Browser** — system fonts are available via the Local Font Access API (Chrome/Edge)

## Tips

- The font list is preloaded at startup so the picker opens without delay.
- IME input (Chinese, Japanese, Korean) is fully supported through the phantom textarea.
- Rich text formatting survives .fig import/export — style runs map to Figma's `characterStyleIDs`.
- See [Components](./components) for how text overrides work in component instances.
