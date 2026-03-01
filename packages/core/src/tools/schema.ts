/**
 * Tool definition schema.
 *
 * Each tool is defined once with typed params and an execute function
 * that operates on FigmaAPI. Adapters for AI chat (valibot), CLI (citty),
 * and MCP (JSON Schema) are generated from these definitions.
 */

import { parseColor } from '../color'

import type { FigmaAPI, FigmaNodeProxy } from '../figma-api'

export type ParamType = 'string' | 'number' | 'boolean' | 'color' | 'string[]'

export interface ParamDef {
  type: ParamType
  description: string
  required?: boolean
  default?: unknown
  enum?: string[]
  min?: number
  max?: number
}

export interface ToolDef {
  name: string
  description: string
  params: Record<string, ParamDef>
  execute: (figma: FigmaAPI, args: Record<string, any>) => unknown
}

type ResolvedType<T extends ParamType> = T extends 'string'
  ? string
  : T extends 'number'
    ? number
    : T extends 'boolean'
      ? boolean
      : T extends 'color'
        ? string
        : T extends 'string[]'
          ? string[]
          : never

type ResolvedParams<P extends Record<string, ParamDef>> = {
  [K in keyof P as P[K]['required'] extends true ? K : never]: ResolvedType<P[K]['type']>
} & {
  [K in keyof P as P[K]['required'] extends true ? never : K]?: ResolvedType<P[K]['type']>
}

export function defineTool<P extends Record<string, ParamDef>>(def: {
  name: string
  description: string
  params: P
  execute: (figma: FigmaAPI, args: ResolvedParams<P>) => unknown
}): ToolDef {
  return def as unknown as ToolDef
}

function nodeToResult(node: FigmaNodeProxy): Record<string, unknown> {
  return node.toJSON()
}

function nodeSummary(node: FigmaNodeProxy): { id: string; name: string; type: string } {
  return { id: node.id, name: node.name, type: node.type }
}

// ─── Read tools ───────────────────────────────────────────────

export const getSelection = defineTool({
  name: 'get_selection',
  description: 'Get details about currently selected nodes.',
  params: {},
  execute: (figma) => {
    const sel = figma.currentPage.selection
    return { selection: sel.map(nodeToResult) }
  }
})

export const getPageTree = defineTool({
  name: 'get_page_tree',
  description:
    'Get the node tree of the current page. Returns all nodes with hierarchy, types, positions, and sizes.',
  params: {},
  execute: (figma) => {
    const page = figma.currentPage
    return {
      page: page.name,
      children: page.children.map(nodeToResult)
    }
  }
})

export const getNode = defineTool({
  name: 'get_node',
  description: 'Get detailed properties of a node by ID.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true }
  },
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    return nodeToResult(node)
  }
})

export const findNodes = defineTool({
  name: 'find_nodes',
  description: 'Find nodes by name pattern and/or type.',
  params: {
    name: { type: 'string', description: 'Name substring to match (case-insensitive)' },
    type: {
      type: 'string',
      description: 'Node type filter',
      enum: [
        'FRAME',
        'RECTANGLE',
        'ELLIPSE',
        'TEXT',
        'LINE',
        'STAR',
        'POLYGON',
        'SECTION',
        'GROUP',
        'COMPONENT',
        'INSTANCE',
        'VECTOR'
      ]
    }
  },
  execute: (figma, args) => {
    const page = figma.currentPage
    const matches = page.findAll((node) => {
      if (args.type && node.type !== args.type) return false
      if (args.name && !node.name.toLowerCase().includes(args.name.toLowerCase())) return false
      return true
    })
    return { count: matches.length, nodes: matches.map(nodeSummary) }
  }
})

// ─── Create tools ─────────────────────────────────────────────

export const createShape = defineTool({
  name: 'create_shape',
  description:
    'Create a shape on the canvas. Use FRAME for containers/cards, RECTANGLE for solid blocks, ELLIPSE for circles, TEXT for labels, SECTION for page sections.',
  params: {
    type: {
      type: 'string',
      description: 'Node type',
      required: true,
      enum: ['FRAME', 'RECTANGLE', 'ELLIPSE', 'TEXT', 'LINE', 'STAR', 'POLYGON', 'SECTION']
    },
    x: { type: 'number', description: 'X position', required: true },
    y: { type: 'number', description: 'Y position', required: true },
    width: { type: 'number', description: 'Width in pixels', required: true, min: 1 },
    height: { type: 'number', description: 'Height in pixels', required: true, min: 1 },
    name: { type: 'string', description: 'Node name shown in layers panel' },
    parent_id: { type: 'string', description: 'Parent node ID to nest inside' }
  },
  execute: (figma, args) => {
    const parentId = args.parent_id
    const parent = parentId ? figma.getNodeById(parentId) : null
    const createMap: Record<string, () => FigmaNodeProxy> = {
      FRAME: () => figma.createFrame(),
      RECTANGLE: () => figma.createRectangle(),
      ELLIPSE: () => figma.createEllipse(),
      TEXT: () => figma.createText(),
      LINE: () => figma.createLine(),
      STAR: () => figma.createStar(),
      POLYGON: () => figma.createPolygon(),
      SECTION: () => figma.createSection()
    }
    const node = createMap[args.type]!()
    node.x = args.x
    node.y = args.y
    node.resize(args.width, args.height)
    if (args.name) node.name = args.name
    if (parent) parent.appendChild(node)
    return nodeSummary(node)
  }
})

export const render = defineTool({
  name: 'render',
  description:
    'Render JSX to design nodes. Primary creation tool — creates entire component trees in one call. Example: <Frame name="Card" w={320} h="hug" flex="col" gap={16} p={24} bg="#FFF" rounded={16}><Text size={18} weight="bold">Title</Text></Frame>',
  params: {
    jsx: { type: 'string', description: 'JSX string to render', required: true },
    x: { type: 'number', description: 'X position of the root node' },
    y: { type: 'number', description: 'Y position of the root node' },
    parent_id: { type: 'string', description: 'Parent node ID to render into' }
  },
  execute: async (figma, args) => {
    const { renderJsx } = await import('../render/render-jsx')
    const result = await renderJsx(figma.graph, args.jsx, {
      parentId: args.parent_id ?? figma.currentPageId,
      x: args.x,
      y: args.y
    })
    return { id: result.id, name: result.name, type: result.type, children: result.childIds }
  }
})

// ─── Modify tools ─────────────────────────────────────────────

export const setFill = defineTool({
  name: 'set_fill',
  description: 'Set the fill color of a node. Accepts hex (#ff0000) or named color.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    color: { type: 'color', description: 'Color value (hex like #ff0000)', required: true }
  },
  execute: (figma, { id, color }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }

    const c = parseColor(color)
    node.fills = [{ type: 'SOLID', color: c, opacity: 1, visible: true }]
    return { id, color: c }
  }
})

export const setStroke = defineTool({
  name: 'set_stroke',
  description: 'Set the stroke (border) of a node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    color: { type: 'color', description: 'Stroke color (hex)', required: true },
    weight: { type: 'number', description: 'Stroke weight', default: 1, min: 0.1 },
    align: {
      type: 'string',
      description: 'Stroke alignment',
      default: 'INSIDE',
      enum: ['INSIDE', 'CENTER', 'OUTSIDE']
    }
  },
  execute: (figma, { id, color, weight, align }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }

    const c = parseColor(color)
    node.strokes = [
      {
        color: c,
        weight: weight ?? 1,
        opacity: 1,
        visible: true,
        align: (align ?? 'INSIDE') as 'INSIDE' | 'CENTER' | 'OUTSIDE'
      }
    ]
    return { id, color: c, weight: weight ?? 1 }
  }
})

export const setEffects = defineTool({
  name: 'set_effects',
  description:
    'Set effects on a node (drop shadow, inner shadow, blur). Pass an array or a single effect.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    type: {
      type: 'string',
      description: 'Effect type',
      required: true,
      enum: ['DROP_SHADOW', 'INNER_SHADOW', 'FOREGROUND_BLUR', 'BACKGROUND_BLUR']
    },
    color: { type: 'color', description: 'Shadow color (hex). Ignored for blur.' },
    offset_x: { type: 'number', description: 'Shadow X offset', default: 0 },
    offset_y: { type: 'number', description: 'Shadow Y offset', default: 4 },
    radius: { type: 'number', description: 'Blur radius', default: 4, min: 0 },
    spread: { type: 'number', description: 'Shadow spread', default: 0 }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }

    const isBlur = args.type === 'FOREGROUND_BLUR' || args.type === 'BACKGROUND_BLUR'
    const effect: Record<string, unknown> = {
      type: args.type,
      visible: true,
      radius: args.radius ?? 4
    }

    if (!isBlur) {
      effect.color = args.color ? parseColor(args.color) : { r: 0, g: 0, b: 0, a: 0.25 }
      effect.offset = { x: args.offset_x ?? 0, y: args.offset_y ?? 4 }
      effect.spread = args.spread ?? 0
    }

    node.effects = [...node.effects, effect as any]
    return { id: args.id, effects: node.effects.length }
  }
})

export const updateNode = defineTool({
  name: 'update_node',
  description:
    'Update properties of an existing node: position, size, opacity, corner radius, visibility, text, font.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    x: { type: 'number', description: 'X position' },
    y: { type: 'number', description: 'Y position' },
    width: { type: 'number', description: 'Width', min: 1 },
    height: { type: 'number', description: 'Height', min: 1 },
    opacity: { type: 'number', description: 'Opacity (0-1)', min: 0, max: 1 },
    corner_radius: { type: 'number', description: 'Corner radius', min: 0 },
    visible: { type: 'boolean', description: 'Visibility' },
    text: { type: 'string', description: 'Text content (TEXT nodes)' },
    font_size: { type: 'number', description: 'Font size', min: 1 },
    font_weight: { type: 'number', description: 'Font weight (100-900)' },
    name: { type: 'string', description: 'Layer name' }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
    const updated: string[] = []
    if (args.x !== undefined) {
      node.x = args.x
      updated.push('x')
    }
    if (args.y !== undefined) {
      node.y = args.y
      updated.push('y')
    }
    if (args.width !== undefined || args.height !== undefined) {
      node.resize(args.width ?? node.width, args.height ?? node.height)
      updated.push('size')
    }
    if (args.opacity !== undefined) {
      node.opacity = args.opacity
      updated.push('opacity')
    }
    if (args.corner_radius !== undefined) {
      node.cornerRadius = args.corner_radius
      updated.push('cornerRadius')
    }
    if (args.visible !== undefined) {
      node.visible = args.visible
      updated.push('visible')
    }
    if (args.name !== undefined) {
      node.name = args.name
      updated.push('name')
    }
    if (args.text !== undefined) {
      figma.graph.updateNode(node.id, { text: args.text })
      updated.push('text')
    }
    if (args.font_size !== undefined) {
      figma.graph.updateNode(node.id, { fontSize: args.font_size })
      updated.push('fontSize')
    }
    if (args.font_weight !== undefined) {
      figma.graph.updateNode(node.id, { fontWeight: args.font_weight })
      updated.push('fontWeight')
    }
    return { id: args.id, updated }
  }
})

export const setLayout = defineTool({
  name: 'set_layout',
  description: 'Set auto-layout (flexbox) on a frame. Direction, alignment, spacing, padding.',
  params: {
    id: { type: 'string', description: 'Frame node ID', required: true },
    direction: {
      type: 'string',
      description: 'Layout direction',
      required: true,
      enum: ['HORIZONTAL', 'VERTICAL']
    },
    spacing: { type: 'number', description: 'Gap between items', default: 0, min: 0 },
    padding: { type: 'number', description: 'Equal padding on all sides', min: 0 },
    padding_horizontal: { type: 'number', description: 'Horizontal padding', min: 0 },
    padding_vertical: { type: 'number', description: 'Vertical padding', min: 0 },
    align: {
      type: 'string',
      description: 'Primary axis alignment',
      default: 'MIN',
      enum: ['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN']
    },
    counter_align: {
      type: 'string',
      description: 'Cross axis alignment',
      default: 'MIN',
      enum: ['MIN', 'CENTER', 'MAX', 'STRETCH']
    }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }

    node.layoutMode = args.direction as 'HORIZONTAL' | 'VERTICAL'
    node.itemSpacing = args.spacing ?? 0
    node.primaryAxisAlignItems = (args.align ?? 'MIN') as any
    node.counterAxisAlignItems = (args.counter_align ?? 'MIN') as any

    const ph = args.padding_horizontal ?? args.padding ?? 0
    const pv = args.padding_vertical ?? args.padding ?? 0
    node.paddingLeft = ph
    node.paddingRight = ph
    node.paddingTop = pv
    node.paddingBottom = pv

    return { id: args.id, direction: args.direction, spacing: args.spacing ?? 0 }
  }
})

export const setConstraints = defineTool({
  name: 'set_constraints',
  description: 'Set resize constraints for a node within its parent.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    horizontal: {
      type: 'string',
      description: 'Horizontal constraint',
      enum: ['MIN', 'CENTER', 'MAX', 'STRETCH', 'SCALE']
    },
    vertical: {
      type: 'string',
      description: 'Vertical constraint',
      enum: ['MIN', 'CENTER', 'MAX', 'STRETCH', 'SCALE']
    }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
    if (args.horizontal || args.vertical) {
      node.constraints = {
        horizontal: args.horizontal ?? node.constraints.horizontal,
        vertical: args.vertical ?? node.constraints.vertical
      }
    }
    return { id: args.id, constraints: node.constraints }
  }
})

// ─── Structure tools ──────────────────────────────────────────

export const deleteNode = defineTool({
  name: 'delete_node',
  description: 'Delete a node by ID.',
  params: {
    id: { type: 'string', description: 'Node ID to delete', required: true }
  },
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.remove()
    return { deleted: id }
  }
})

export const cloneNode = defineTool({
  name: 'clone_node',
  description: 'Clone (duplicate) a node.',
  params: {
    id: { type: 'string', description: 'Node ID to clone', required: true }
  },
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    const clone = node.clone()
    return nodeSummary(clone)
  }
})

export const renameNode = defineTool({
  name: 'rename_node',
  description: 'Rename a node in the layers panel.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    name: { type: 'string', description: 'New name', required: true }
  },
  execute: (figma, { id, name }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.name = name
    return { id, name }
  }
})

export const reparentNode = defineTool({
  name: 'reparent_node',
  description: 'Move a node into a different parent.',
  params: {
    id: { type: 'string', description: 'Node ID to move', required: true },
    parent_id: { type: 'string', description: 'New parent node ID', required: true }
  },
  execute: (figma, { id, parent_id }) => {
    const node = figma.getNodeById(id)
    const parent = figma.getNodeById(parent_id)
    if (!node) return { error: `Node "${id}" not found` }
    if (!parent) return { error: `Parent "${parent_id}" not found` }
    parent.appendChild(node)
    return { id, parent_id }
  }
})

export const selectNodes = defineTool({
  name: 'select_nodes',
  description: 'Select one or more nodes by ID.',
  params: {
    ids: { type: 'string[]', description: 'Node IDs to select', required: true }
  },
  execute: (figma, { ids }) => {
    figma.currentPage.selection = ids
      .map((id) => figma.getNodeById(id))
      .filter((n): n is FigmaNodeProxy => n !== null)
    return { selected: ids }
  }
})

export const groupNodes = defineTool({
  name: 'group_nodes',
  description: 'Group selected nodes.',
  params: {
    ids: { type: 'string[]', description: 'Node IDs to group', required: true }
  },
  execute: (figma, { ids }) => {
    const nodes = ids
      .map((id) => figma.getNodeById(id))
      .filter((n): n is FigmaNodeProxy => n !== null)
    if (nodes.length < 2) return { error: 'Need at least 2 nodes to group' }
    const parent = nodes[0]!.parent ?? figma.currentPage
    const group = figma.group(nodes, parent)
    return nodeSummary(group)
  }
})

export const ungroupNode = defineTool({
  name: 'ungroup_node',
  description: 'Ungroup a group node.',
  params: {
    id: { type: 'string', description: 'Group node ID', required: true }
  },
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    figma.ungroup(node)
    return { ungrouped: id }
  }
})

// ─── Component tools ──────────────────────────────────────────

export const createComponent = defineTool({
  name: 'create_component',
  description: 'Convert a frame/group into a component.',
  params: {
    id: { type: 'string', description: 'Node ID to convert', required: true }
  },
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    const comp = figma.createComponentFromNode(node)
    return nodeSummary(comp)
  }
})

export const createInstance = defineTool({
  name: 'create_instance',
  description: 'Create an instance of a component.',
  params: {
    component_id: { type: 'string', description: 'Component node ID', required: true },
    x: { type: 'number', description: 'X position' },
    y: { type: 'number', description: 'Y position' }
  },
  execute: (figma, args) => {
    const comp = figma.getNodeById(args.component_id)
    if (!comp) return { error: `Component "${args.component_id}" not found` }
    const instance = comp.createInstance()
    if (args.x !== undefined) instance.x = args.x
    if (args.y !== undefined) instance.y = args.y
    return nodeSummary(instance)
  }
})

// ─── Page tools ───────────────────────────────────────────────

export const listPages = defineTool({
  name: 'list_pages',
  description: 'List all pages in the document.',
  params: {},
  execute: (figma) => {
    const pages = figma.root.children
    return {
      current: figma.currentPage.name,
      pages: pages.map((p) => ({ id: p.id, name: p.name }))
    }
  }
})

export const switchPage = defineTool({
  name: 'switch_page',
  description: 'Switch to a different page by name or ID.',
  params: {
    page: { type: 'string', description: 'Page name or ID', required: true }
  },
  execute: (figma, { page }) => {
    const target = figma.root.children.find((p) => p.name === page) ?? figma.getNodeById(page)
    if (!target) return { error: `Page "${page}" not found` }
    figma.currentPage = target
    return { page: target.name, id: target.id }
  }
})

// ─── Variable tools ───────────────────────────────────────────

export const listVariables = defineTool({
  name: 'list_variables',
  description: 'List all design variables (colors, numbers, strings, booleans).',
  params: {
    type: {
      type: 'string',
      description: 'Filter by variable type',
      enum: ['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']
    }
  },
  execute: (figma, args) => {
    const vars = figma.getLocalVariables(args.type)
    return { count: vars.length, variables: vars }
  }
})

export const listCollections = defineTool({
  name: 'list_collections',
  description: 'List all variable collections.',
  params: {},
  execute: (figma) => {
    const cols = figma.getLocalVariableCollections()
    return { count: cols.length, collections: cols }
  }
})

// ─── Eval escape hatch ────────────────────────────────────────

export const evalCode = defineTool({
  name: 'eval',
  description:
    'Execute JavaScript with full Figma Plugin API access. Use for operations not covered by other tools. The `figma` global is available.',
  params: {
    code: { type: 'string', description: 'JavaScript code to execute', required: true }
  },
  execute: async (figma, { code }) => {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    const wrapped = code.trim().startsWith('return') ? code : `return (async () => { ${code} })()`
    const fn = new AsyncFunction('figma', wrapped)
    const result = await fn(figma)
    if (result && typeof result === 'object' && 'toJSON' in result) return result.toJSON()
    return result ?? null
  }
})

// ─── Registry ─────────────────────────────────────────────────

export const ALL_TOOLS: ToolDef[] = [
  getSelection,
  getPageTree,
  getNode,
  findNodes,
  createShape,
  render,
  setFill,
  setStroke,
  setEffects,
  updateNode,
  setLayout,
  setConstraints,
  deleteNode,
  cloneNode,
  renameNode,
  reparentNode,
  selectNodes,
  groupNodes,
  ungroupNode,
  createComponent,
  createInstance,
  listPages,
  switchPage,
  listVariables,
  listCollections,
  evalCode
]
