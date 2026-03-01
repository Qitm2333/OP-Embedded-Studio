## 1. Create Comparison Page

- [x] 1.1 Create `docs/guide/figma-comparison.md` with frontmatter (title, description for SEO), intro paragraph explaining scope (Figma Design features only, not FigJam/Slides/SaaS-admin), status legend (✅ = works, 🟡 = partial — core behavior exists but advanced options/edge cases missing, 🔲 = not yet implemented), and a summary progress line
- [x] 1.2 Write "Interface & Navigation" table (toolbar, layers panel, pages, zoom/pan, rulers, guides, actions menu, keyboard shortcuts, background color, outlines view, find & replace)
- [x] 1.3 Write "Layers & Shapes" table (shape tools, frames, groups, sections, masks, arc tool, pencil tool, selection, alignment/position/rotation, copy/paste, lock/visibility, rename, scale, constraints, smart selection, layout guides, measure distances)
- [x] 1.4 Write "Vector Tools" table (vector networks, pen tool, edit vectors, boolean operations, flatten, stroke-to-path, text-to-path, shape builder, offset/simplify path)
- [x] 1.5 Write "Text & Typography" table (text tool, text properties, font loading, text styles, lists, links, emojis, OpenType, variable fonts, CJK, RTL, text resizing)
- [x] 1.6 Write "Color, Gradients & Images" table (color picker, solid/gradient/image/pattern fills, blend modes, images, eyedropper, mixed selection colors, color models)
- [x] 1.7 Write "Effects & Properties" table (drop shadow, inner shadow, layer blur, background blur, strokes cap/join/dash, corner radius, smoothing)
- [x] 1.8 Write "Auto Layout" table (horizontal/vertical flow, grid flow, gap, padding, alignment, child sizing, wrap, combined flows)
- [x] 1.9 Write "Components & Design Systems" table (components, instances, variants, component properties, variables, collections, modes, styles, libraries)
- [x] 1.10 Write "Prototyping" table (connections, triggers, actions, animations, overlays, scroll, smart animate, flows, variables in prototypes)
- [x] 1.11 Write "Import & Export" table (.fig import, .fig export, clipboard, Sketch import, image/SVG export, version history)
- [x] 1.12 Write "Collaboration & Dev Mode" table (comments, multiplayer, branching, cursor chat, Dev Mode inspect, code connect, MCP server)

Feature sources: `../figma-docs/` articles (~90 files). Status determined by cross-referencing Open Pencil openspec specs (20 specs in `openspec/specs/`) and `docs/guide/features.md`. Criteria: ✅ = feature works end-to-end per the spec, 🟡 = core behavior present but notable sub-features missing, 🔲 = not implemented at all.

## 2. VitePress Integration

- [x] 2.1 Add "Figma Feature Matrix" entry to the Guide sidebar section in `docs/.vitepress/config.ts` after "Comparison"

## 3. Verify

- [x] 3.1 Run `bun run docs:build` to confirm the page builds without errors
