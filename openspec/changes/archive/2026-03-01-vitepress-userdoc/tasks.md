## 1. User Guide Landing Page

- [x] 1.1 Create `docs/user-guide/index.md` with `layout: doc` frontmatter (title, description), intro paragraph, and categorized links to all articles (Getting Around, Creating Content, Organizing & Managing, Advanced Features). Include cross-platform shortcut note (⌘=Ctrl, ⌥=Alt on Win/Linux) that all articles reference.

## 2. Core Articles — Getting Around

- [x] 2.1 Create `docs/user-guide/canvas-navigation.md` — derived from `openspec/specs/canvas-navigation/spec.md`. Frontmatter with title+description. Sections: Panning (space+drag, middle mouse, trackpad, hand tool H), Zooming (ctrl+scroll, pinch, ⌘+/⌘-/⌘0). Shortcuts table with Mac and Win/Linux columns. Cross-link to selection article.
- [x] 2.2 Create `docs/user-guide/selection-and-manipulation.md` — derived from `openspec/specs/selection-manipulation/spec.md`. Frontmatter. Sections: Selecting (click/shift/marquee/⌘A), Moving (drag, arrow nudge 1px/10px), Resizing (8 handles, shift=proportional), Rotating (shift=15° snap), Duplicating (alt+drag, ⌘D), Deleting (⌫), Z-order (]/[), Visibility (⇧⌘H), Lock (⇧⌘L), Move-to-page. Shortcuts table Mac+Win/Linux. Cross-links to context-menu, layers articles.

## 3. Core Articles — Creating Content

- [x] 3.1 Create `docs/user-guide/drawing-shapes.md` — derived from `openspec/specs/editor-ui/spec.md` (toolbar, shape tools) + `openspec/specs/canvas-rendering/spec.md`. Frontmatter. Sections: Toolbar overview, Shape tools (Rectangle R, Ellipse O, Line L, Frame F, Section S), Shapes flyout (Polygon, Star), Constrained drawing (shift), Shape properties (fill, stroke, corner radius, effects). Shortcuts table. Cross-links to auto-layout, exporting.
- [x] 3.2 Create `docs/user-guide/text-editing.md` — derived from `openspec/specs/text-editing/spec.md`. Frontmatter. Sections: Creating text (T tool), Inline editing (double-click), Cursor navigation (arrows, ⌘←/→, ⌥←/→), Text selection (click/drag/double-click=word/triple-click=all), Rich text formatting (⌘B/I/U/S), Font picker, Font weight. Shortcuts table. Cross-link to components.
- [x] 3.3 Create `docs/user-guide/pen-tool.md` — derived from `openspec/specs/pen-tool/spec.md`. Frontmatter. Sections: Activating (P), Corner points (click), Curve points (click+drag, bezier handles), Closing paths (click first point), Open paths (Escape), Preview line. Shortcuts table.

## 4. Core Articles — Organizing & Managing

- [x] 4.1 Create `docs/user-guide/layers-and-pages.md` — derived from `openspec/specs/editor-ui/spec.md` (layers panel, pages panel). Frontmatter. Sections: Layers panel (tree view, expand/collapse, drag reorder, visibility toggle, rename), Pages panel (switch, add, delete, inline rename), Properties panel tabs (Design/Code/AI). Cross-links to selection, components.
- [x] 4.2 Create `docs/user-guide/context-menu.md` — derived from `openspec/specs/context-menu/spec.md`. Frontmatter. Sections: Opening (right-click), Clipboard actions (⌘C/X/V, ⌘D, ⌫), Z-order (]/[), Grouping (⌘G/⇧⌘G, ⇧A), Component actions (purple: ⌥⌘K, ⇧⌘K, create instance, go-to-main, ⌥⌘B), Visibility/Lock (⇧⌘H/⇧⌘L), Move-to-page submenu. Full action table.
- [x] 4.3 Create `docs/user-guide/exporting.md` — derived from `openspec/specs/editor-ui/spec.md` (export section) + `openspec/specs/fig-import/spec.md`. Frontmatter. Sections: Image export (scale 0.5×–4×, format PNG/JPG/WEBP, multi-export, ⇧⌘E, context menu), File operations (.fig save ⌘S/⇧⌘S, .fig import/open). Shortcuts table.

## 5. Core Articles — Advanced Features

- [x] 5.1 Create `docs/user-guide/auto-layout.md` — derived from `openspec/specs/auto-layout/spec.md`. Frontmatter. Sections: Enabling (⇧A toggle), Direction (horizontal/vertical/wrap), Spacing (gap, padding uniform+per-side), Alignment (justify, align), Child sizing (fixed/fill/hug), Drag reordering, Wrapping selection. Shortcuts table. Cross-link to components, drawing-shapes.
- [x] 5.2 Create `docs/user-guide/components.md` — derived from `openspec/specs/components/spec.md`. Frontmatter. Sections: Creating components (⌥⌘K, single vs multi-node), Component sets (⇧⌘K, dashed purple border), Instances (context menu, placed 40px right), Detaching (⌥⌘B), Go-to-main (context menu, cross-page), Live sync (fills, size, effects, layout), Overrides (child property preservation), Visual treatment (purple labels, opaque hit testing, double-click to enter). Shortcuts table.
- [x] 5.3 Create `docs/user-guide/variables.md` — derived from `openspec/specs/editor-ui/spec.md` (variables dialog, fill variable picker). Frontmatter. Sections: Opening variables dialog (settings icon in page properties), Collections and modes, Creating/editing variables, Color variables (inline color input), Binding to fills (purple badge), Detaching bindings. Cross-link to drawing-shapes.

## 6. VitePress Config Update

- [x] 6.1 Update `docs/.vitepress/config.ts` — add "User Guide" as first sidebar group with entries: Overview (/user-guide/), Canvas Navigation, Selection & Manipulation, Drawing Shapes, Text Editing, Pen Tool, Layers & Pages, Context Menu, Exporting, Auto Layout, Components, Variables. Add "User Guide" nav entry before existing "Guide". Verify existing Guide/Reference/Development groups unchanged.
