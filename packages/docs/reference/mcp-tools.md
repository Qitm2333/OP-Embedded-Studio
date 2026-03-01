# MCP Tools

The editor exposes its entire API through MCP (Model Context Protocol). Every operation available to a human is available to AI. 117 tools across 15 categories.

## AI Workflow

1. **Read** — `node_tree`, `find`, `analyze_*`
2. **Create/Modify** — `create_*`, `set_*`, `node_*`, `render` (JSX)
3. **Verify** — `export_screenshot` → inspect the image
4. **Iterate** — `diff_create` to see changes, fix issues
5. **Export** — `export_jsx`, `export_storybook` for developer handoff

## Create (14 tools)

| Tool | Description |
|------|-------------|
| `create_frame` | Create a frame |
| `create_rect` | Create a rectangle |
| `create_ellipse` | Create an ellipse |
| `create_text` | Create a text node |
| `create_line` | Create a line |
| `create_polygon` | Create a polygon |
| `create_star` | Create a star |
| `create_vector` | Create a vector path |
| `create_component` | Create a component |
| `create_instance` | Create a component instance |
| `create_section` | Create a section |
| `create_page` | Create a page |
| `create_slice` | Create a slice |
| `create_icon` | Create an icon from Iconify |

## Set / Modify (18 tools)

| Tool | Description |
|------|-------------|
| `set_fill` | Set fill color (hex or variable ref) |
| `set_stroke` | Set stroke color and weight |
| `set_stroke-align` | Set stroke alignment |
| `set_radius` | Set corner radius |
| `set_opacity` | Set opacity |
| `set_rotation` | Set rotation angle |
| `set_blend` | Set blend mode |
| `set_visible` | Set visibility |
| `set_locked` | Set locked state |
| `set_text` | Set text content |
| `set_text-resize` | Set text auto resize mode |
| `set_font` | Set font properties |
| `set_font-range` | Set font for a text range |
| `set_effect` | Set effect (shadow, blur) |
| `set_image` | Set image fill |
| `set_layout` | Set auto-layout properties |
| `set_constraints` | Set resize constraints |
| `set_minmax` | Set min/max width and height |

## Node Operations (15 tools)

| Tool | Description |
|------|-------------|
| `node_get` | Get node properties |
| `node_tree` | Get node tree with properties |
| `node_children` | Get child nodes |
| `node_ancestors` | Get ancestor chain to root |
| `node_bounds` | Get bounding box |
| `node_bindings` | Get variable bindings |
| `node_move` | Move a node |
| `node_resize` | Resize a node |
| `node_rename` | Rename a node |
| `node_clone` | Clone node(s) |
| `node_delete` | Delete node(s) |
| `node_set-parent` | Reparent a node |
| `node_replace-with` | Replace node with another |
| `node_to-component` | Convert frame to component |
| `find` | Find nodes by name or type |

## Variables & Collections (11 tools)

| Tool | Description |
|------|-------------|
| `variable_list` | List all variables |
| `variable_get` | Get variable by ID |
| `variable_find` | Find variables by name |
| `variable_create` | Create a variable |
| `variable_set` | Set variable value for mode |
| `variable_bind` | Bind variable to node property |
| `variable_delete` | Delete a variable |
| `collection_list` | List variable collections |
| `collection_get` | Get collection by ID |
| `collection_create` | Create a collection |
| `collection_delete` | Delete a collection |

## Components (4 tools)

| Tool | Description |
|------|-------------|
| `component_add-prop` | Add property to component |
| `component_edit-prop` | Edit component property |
| `component_delete-prop` | Delete component property |
| `component_combine` | Combine into component set (variants) |

## Styles (4 tools)

| Tool | Description |
|------|-------------|
| `style_list` | List local styles |
| `style_create-paint` | Create paint/color style |
| `style_create-text` | Create text style |
| `style_create-effect` | Create effect style |

## Boolean Operations (4 tools)

| Tool | Description |
|------|-------------|
| `boolean_union` | Union shapes |
| `boolean_subtract` | Subtract shapes |
| `boolean_intersect` | Intersect shapes |
| `boolean_exclude` | Exclude shapes |

## Vector Paths (5 tools)

| Tool | Description |
|------|-------------|
| `path_get` | Get vector path data |
| `path_set` | Set vector path data |
| `path_move` | Move all path points |
| `path_scale` | Scale path from center |
| `path_flip` | Flip path H/V |

## Groups (3 tools)

| Tool | Description |
|------|-------------|
| `group_create` | Group nodes |
| `group_ungroup` | Ungroup nodes |
| `group_flatten` | Flatten to single vector |

## Analyze (5 tools)

| Tool | Description |
|------|-------------|
| `analyze_colors` | Color palette usage |
| `analyze_typography` | Typography usage |
| `analyze_spacing` | Spacing values |
| `analyze_clusters` | Repeated patterns |
| `analyze_snapshot` | Accessibility tree |

## Export (6 tools)

| Tool | Description |
|------|-------------|
| `export_node` | Export node as image |
| `export_screenshot` | Screenshot viewport |
| `export_selection` | Export selection as image |
| `export_jsx` | Export as JSX component |
| `export_storybook` | Export as Storybook stories |
| `export_fonts` | List fonts used |

## Diff (5 tools)

| Tool | Description |
|------|-------------|
| `diff_create` | Diff between two nodes |
| `diff_show` | Show diff vs provided props |
| `diff_apply` | Apply a diff patch |
| `diff_visual` | Visual diff as PNG |
| `diff_jsx` | JSX diff between nodes |

## Pages & Viewport (7 tools)

| Tool | Description |
|------|-------------|
| `page_list` | List all pages |
| `page_current` | Get current page |
| `page_set` | Switch to page |
| `page_bounds` | Bounding box of all objects |
| `viewport_get` | Get viewport position/zoom |
| `viewport_set` | Set viewport position/zoom |
| `viewport_zoom-to-fit` | Zoom to fit nodes |

## Selection & Connectors (6 tools)

| Tool | Description |
|------|-------------|
| `selection_get` | Get selected nodes |
| `selection_set` | Set selection |
| `connector_create` | Create connector |
| `connector_get` | Get connector details |
| `connector_set` | Update connector |
| `connector_list` | List connectors |

## Meta (10 tools)

| Tool | Description |
|------|-------------|
| `status` | Check connection |
| `lint` | Lint design |
| `import` | Import SVG |
| `render` | Render JSX to nodes |
| `get_components` | Get all components |
| `get_styles` | Get local styles |
| `get_pages` | Get all pages |
| `font_list` | List available fonts |
| `comment_watch` | Wait for new comment |
| `eval` | Execute JS in editor |
