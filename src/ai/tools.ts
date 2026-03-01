import { valibotSchema } from '@ai-sdk/valibot'
import { parseColor, FigmaAPI } from '@open-pencil/core'
import { tool } from 'ai'
import * as v from 'valibot'

import type { EditorStore } from '@/stores/editor'
import type { Color } from '@open-pencil/core'

const nodeTypeSchema = v.picklist([
  'FRAME',
  'RECTANGLE',
  'ELLIPSE',
  'TEXT',
  'LINE',
  'STAR',
  'POLYGON',
  'SECTION'
])

const rgbaSchema = v.object({
  r: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  g: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  b: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  a: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1)), 1)
})

const hexSchema = v.pipe(
  v.string(),
  v.regex(/^#?[0-9a-fA-F]{6,8}$/),
  v.description('Hex color like #ff0000 or #ff000080')
)

const colorInputSchema = v.union([rgbaSchema, hexSchema])

type ColorInput = v.InferOutput<typeof colorInputSchema>

function resolveColor(input: ColorInput): Color {
  if (typeof input === 'string') return parseColor(input)
  return { r: input.r, g: input.g, b: input.b, a: input.a ?? 1 }
}

export function createAITools(store: EditorStore) {
  return {
    create_shape: tool({
      description:
        'Create a shape on the canvas. Use FRAME for containers/cards, RECTANGLE for solid blocks, ELLIPSE for circles, TEXT for labels, SECTION for page sections.',
      inputSchema: valibotSchema(
        v.object({
          type: nodeTypeSchema,
          x: v.pipe(v.number(), v.description('X position in canvas coordinates')),
          y: v.pipe(v.number(), v.description('Y position in canvas coordinates')),
          width: v.pipe(v.number(), v.minValue(1), v.description('Width in pixels')),
          height: v.pipe(v.number(), v.minValue(1), v.description('Height in pixels')),
          name: v.optional(v.pipe(v.string(), v.description('Node name shown in layers panel'))),
          parent_id: v.optional(v.pipe(v.string(), v.description('Parent node ID to nest inside')))
        })
      ),
      execute: async ({ type, x, y, width, height, name, parent_id }) => {
        const id = store.createShape(type, x, y, width, height, parent_id)
        if (name) store.renameNode(id, name)
        store.select([id])
        return { id, type, x, y, width, height, name: name ?? type.toLowerCase() }
      }
    }),

    set_fill: tool({
      description: 'Set the fill color of a node. Accepts hex (#ff0000) or RGBA object.',
      inputSchema: valibotSchema(
        v.object({
          id: v.pipe(v.string(), v.description('Node ID')),
          color: colorInputSchema
        })
      ),
      execute: async ({ id, color }) => {
        const c = resolveColor(color)
        store.updateNodeWithUndo(
          id,
          { fills: [{ type: 'SOLID', color: c, opacity: 1, visible: true }] },
          'Set fill'
        )
        return { id, color: c }
      }
    }),

    set_stroke: tool({
      description: 'Set the stroke (border) of a node.',
      inputSchema: valibotSchema(
        v.object({
          id: v.pipe(v.string(), v.description('Node ID')),
          color: colorInputSchema,
          weight: v.optional(v.pipe(v.number(), v.minValue(0.1)), 1),
          align: v.optional(v.picklist(['INSIDE', 'CENTER', 'OUTSIDE']), 'INSIDE')
        })
      ),
      execute: async ({ id, color, weight, align }) => {
        const c = resolveColor(color)
        store.updateNodeWithUndo(
          id,
          { strokes: [{ color: c, weight, opacity: 1, visible: true, align }] },
          'Set stroke'
        )
        return { id, color: c, weight }
      }
    }),

    update_node: tool({
      description:
        'Update properties of an existing node: position, size, opacity, corner radius, visibility, text content, font.',
      inputSchema: valibotSchema(
        v.object({
          id: v.pipe(v.string(), v.description('Node ID')),
          x: v.optional(v.number()),
          y: v.optional(v.number()),
          width: v.optional(v.pipe(v.number(), v.minValue(1))),
          height: v.optional(v.pipe(v.number(), v.minValue(1))),
          opacity: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1))),
          corner_radius: v.optional(v.pipe(v.number(), v.minValue(0))),
          visible: v.optional(v.boolean()),
          text: v.optional(v.pipe(v.string(), v.description('Text content (for TEXT nodes)'))),
          font_size: v.optional(v.pipe(v.number(), v.minValue(1))),
          font_weight: v.optional(v.number()),
          name: v.optional(v.string())
        })
      ),
      execute: async ({ id, corner_radius, font_size, font_weight, name, ...rest }) => {
        const changes: Record<string, unknown> = { ...rest }
        if (corner_radius !== undefined) changes.cornerRadius = corner_radius
        if (font_size !== undefined) changes.fontSize = font_size
        if (font_weight !== undefined) changes.fontWeight = font_weight
        store.updateNodeWithUndo(id, changes, 'Update node')
        if (name !== undefined) store.renameNode(id, name)
        return { id, updated: Object.keys(changes) }
      }
    }),

    set_layout: tool({
      description:
        'Set auto-layout (flexbox) on a frame. Direction, alignment, spacing, and padding.',
      inputSchema: valibotSchema(
        v.object({
          id: v.pipe(v.string(), v.description('Frame node ID')),
          direction: v.picklist(['HORIZONTAL', 'VERTICAL']),
          spacing: v.optional(
            v.pipe(v.number(), v.minValue(0), v.description('Gap between items')),
            0
          ),
          padding: v.optional(
            v.pipe(v.number(), v.minValue(0), v.description('Equal padding on all sides'))
          ),
          padding_horizontal: v.optional(v.pipe(v.number(), v.minValue(0))),
          padding_vertical: v.optional(v.pipe(v.number(), v.minValue(0))),
          align: v.optional(
            v.pipe(
              v.picklist(['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN']),
              v.description('Primary axis alignment')
            ),
            'MIN'
          ),
          counter_align: v.optional(
            v.pipe(
              v.picklist(['MIN', 'CENTER', 'MAX', 'STRETCH']),
              v.description('Cross axis alignment')
            ),
            'MIN'
          )
        })
      ),
      execute: async ({
        id,
        direction,
        spacing,
        padding,
        padding_horizontal,
        padding_vertical,
        align,
        counter_align
      }) => {
        store.setLayoutMode(id, direction)
        const ph = padding_horizontal ?? padding ?? 0
        const pv = padding_vertical ?? padding ?? 0
        store.updateNodeWithUndo(
          id,
          {
            itemSpacing: spacing,
            primaryAxisAlign: align,
            counterAxisAlign: counter_align,
            paddingLeft: ph,
            paddingRight: ph,
            paddingTop: pv,
            paddingBottom: pv
          },
          'Set layout'
        )
        return { id, direction, spacing }
      }
    }),

    delete_node: tool({
      description: 'Delete a node by ID.',
      inputSchema: valibotSchema(
        v.object({
          id: v.pipe(v.string(), v.description('Node ID to delete'))
        })
      ),
      execute: async ({ id }) => {
        store.select([id])
        store.deleteSelected()
        return { deleted: id }
      }
    }),

    select_nodes: tool({
      description: 'Select one or more nodes by ID.',
      inputSchema: valibotSchema(
        v.object({
          ids: v.pipe(v.array(v.string()), v.minLength(1), v.description('Node IDs to select'))
        })
      ),
      execute: async ({ ids }) => {
        store.select(ids)
        return { selected: ids }
      }
    }),

    get_page_tree: tool({
      description:
        'Get the node tree of the current page. Returns all nodes with their hierarchy, types, positions, and sizes.',
      inputSchema: valibotSchema(v.object({})),
      execute: async () => {
        const api = new FigmaAPI(store.graph)
        const page = api.getNodeById(store.state.currentPageId)
        if (!page) return { error: 'No current page' }
        return {
          page: page.name,
          children: page.children.map((c) => c.toJSON())
        }
      }
    }),

    get_selection: tool({
      description: 'Get details about currently selected nodes.',
      inputSchema: valibotSchema(v.object({})),
      execute: async () => {
        const nodes = store.selectedNodes.value
        if (nodes.length === 0) return { selection: [] }
        const api = new FigmaAPI(store.graph)
        return {
          selection: nodes.map((n) => api.wrapNode(n.id).toJSON())
        }
      }
    }),

    rename_node: tool({
      description: 'Rename a node in the layers panel.',
      inputSchema: valibotSchema(
        v.object({
          id: v.string(),
          name: v.string()
        })
      ),
      execute: async ({ id, name }) => {
        store.renameNode(id, name)
        return { id, name }
      }
    })
  }
}

export type AITools = ReturnType<typeof createAITools>
