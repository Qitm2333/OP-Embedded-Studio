import { parseColor, colorToFill } from '../color'

import type { SceneGraph, SceneNode, NodeType, Fill, LayoutMode, Stroke } from '../scene-graph'
import type { TreeNode } from './tree'
import { isTreeNode } from './tree'

const TYPE_MAP: Record<string, NodeType> = {
  frame: 'FRAME',
  view: 'FRAME',
  rectangle: 'RECTANGLE',
  rect: 'RECTANGLE',
  ellipse: 'ELLIPSE',
  text: 'TEXT',
  line: 'LINE',
  star: 'STAR',
  polygon: 'POLYGON',
  vector: 'VECTOR',
  group: 'GROUP',
  section: 'SECTION',
  component: 'COMPONENT'
}

const WEIGHT_MAP: Record<string, number> = {
  normal: 400,
  medium: 500,
  bold: 700
}

const ALIGN_MAP: Record<string, 'MIN' | 'MAX' | 'CENTER' | 'SPACE_BETWEEN'> = {
  start: 'MIN',
  end: 'MAX',
  center: 'CENTER',
  between: 'SPACE_BETWEEN'
}

const COUNTER_ALIGN_MAP: Record<string, 'MIN' | 'MAX' | 'CENTER'> = {
  start: 'MIN',
  end: 'MAX',
  center: 'CENTER',
  stretch: 'MIN'
}

const TEXT_ALIGN_MAP: Record<string, SceneNode['textAlignHorizontal']> = {
  left: 'LEFT',
  center: 'CENTER',
  right: 'RIGHT',
  justified: 'JUSTIFIED'
}

const TEXT_AUTO_RESIZE_MAP: Record<string, SceneNode['textAutoResize']> = {
  none: 'NONE',
  width: 'WIDTH_AND_HEIGHT',
  height: 'HEIGHT'
}

function parseFill(value: string): Fill {
  return colorToFill(value)
}

function parseStroke(value: string, width: number): Stroke {
  const color = parseColor(value)
  return {
    color,
    opacity: color.a,
    visible: true,
    weight: width,
    align: 'INSIDE'
  }
}

interface RenderOptions {
  x?: number
  y?: number
  parentId?: string
}

export interface RenderResult {
  id: string
  name: string
  type: NodeType
  childIds: string[]
}

export function renderTree(
  graph: SceneGraph,
  tree: TreeNode,
  options: RenderOptions = {}
): RenderResult {
  const parentId = options.parentId ?? graph.getPages()[0]?.id ?? graph.rootId

  const result = renderNode(graph, tree, parentId)

  if (options.x !== undefined) graph.updateNode(result.id, { x: options.x })
  if (options.y !== undefined) graph.updateNode(result.id, { y: options.y })

  return {
    id: result.id,
    name: result.name,
    type: result.type,
    childIds: result.childIds
  }
}

function renderNode(graph: SceneGraph, tree: TreeNode, parentId: string): SceneNode {
  const nodeType = TYPE_MAP[tree.type]
  if (!nodeType) throw new Error(`Unknown element: <${tree.type}>`)

  const isText = nodeType === 'TEXT'
  const overrides = propsToOverrides(tree.props, isText)

  // Text content from children
  if (isText) {
    const textContent = tree.children
      .filter((c): c is string => typeof c === 'string')
      .join('')
    if (textContent) overrides.text = textContent
  }

  const node = graph.createNode(nodeType, parentId, overrides)

  // Render child nodes (skip string children — already handled for text)
  for (const child of tree.children) {
    if (typeof child === 'string') continue
    if (isTreeNode(child)) {
      renderNode(graph, child, node.id)
    }
  }

  return node
}

function propsToOverrides(props: Record<string, unknown>, isText: boolean): Partial<SceneNode> {
  const o: Partial<SceneNode> = {}

  // Name
  if (props.name) o.name = props.name as string

  // Size
  const w = props.w ?? props.width
  const h = props.h ?? props.height
  if (typeof w === 'number') o.width = w
  if (typeof h === 'number') o.height = h

  // "fill" and "hug" sizing handled via layout sizing
  const hasFlex = props.flex !== undefined
  if (w === 'fill') {
    o.layoutGrow = 1
    o.layoutAlignSelf = 'STRETCH'
  }
  if (h === 'fill') {
    o.layoutAlignSelf = 'STRETCH'
  }

  // Position
  if (props.x !== undefined) o.x = props.x as number
  if (props.y !== undefined) o.y = props.y as number

  // Fill / background
  const bg = props.bg ?? props.fill
  if (typeof bg === 'string') {
    o.fills = [parseFill(bg)]
  }

  // Stroke
  if (typeof props.stroke === 'string') {
    const strokeWidth = (props.strokeWidth as number) ?? 1
    o.strokes = [parseStroke(props.stroke, strokeWidth)]
  }

  // Corner radius
  const rounded = props.rounded ?? props.cornerRadius
  if (typeof rounded === 'number') {
    o.cornerRadius = rounded
  }
  if (props.roundedTL !== undefined || props.roundedTR !== undefined ||
      props.roundedBL !== undefined || props.roundedBR !== undefined) {
    o.independentCorners = true
    if (props.roundedTL !== undefined) o.topLeftRadius = props.roundedTL as number
    if (props.roundedTR !== undefined) o.topRightRadius = props.roundedTR as number
    if (props.roundedBL !== undefined) o.bottomLeftRadius = props.roundedBL as number
    if (props.roundedBR !== undefined) o.bottomRightRadius = props.roundedBR as number
  }
  if (props.cornerSmoothing !== undefined) o.cornerSmoothing = props.cornerSmoothing as number

  // Opacity
  if (props.opacity !== undefined) o.opacity = props.opacity as number

  // Rotation
  if (props.rotate !== undefined) o.rotation = props.rotate as number

  // Blend mode
  if (props.blendMode !== undefined) {
    o.blendMode = (props.blendMode as string).toUpperCase() as SceneNode['blendMode']
  }

  // Overflow / clip
  if (props.overflow === 'hidden') o.clipsContent = true

  // Layout (auto-layout / flexbox)
  if (hasFlex) {
    const dir = props.flex as string
    o.layoutMode = (dir === 'col' || dir === 'column' ? 'VERTICAL' : 'HORIZONTAL') as LayoutMode

    // Default sizing: hug content
    o.primaryAxisSizing = 'HUG'
    o.counterAxisSizing = 'HUG'

    // Override with explicit w/h
    if (typeof w === 'number') o.primaryAxisSizing = 'FIXED'
    if (typeof h === 'number') o.counterAxisSizing = 'FIXED'
    if (w === 'hug') o.primaryAxisSizing = 'HUG'
    if (h === 'hug') o.counterAxisSizing = 'HUG'
  }

  // Gap / spacing
  if (props.gap !== undefined) o.itemSpacing = props.gap as number

  // Wrap
  if (props.wrap) {
    o.layoutWrap = 'WRAP'
    if (props.rowGap !== undefined) o.counterAxisSpacing = props.rowGap as number
  }

  // Alignment
  if (props.justify) {
    o.primaryAxisAlign = ALIGN_MAP[props.justify as string] ?? 'MIN'
  }
  if (props.items) {
    o.counterAxisAlign = COUNTER_ALIGN_MAP[props.items as string] ?? 'MIN'
    if (props.items === 'stretch') {
      // Children should stretch — handled at child level
    }
  }

  // Padding
  const p = props.p ?? props.padding
  if (typeof p === 'number') {
    o.paddingTop = p
    o.paddingRight = p
    o.paddingBottom = p
    o.paddingLeft = p
  }
  const px = props.px as number | undefined
  const py = props.py as number | undefined
  if (px !== undefined) { o.paddingLeft = px; o.paddingRight = px }
  if (py !== undefined) { o.paddingTop = py; o.paddingBottom = py }
  if (props.pt !== undefined) o.paddingTop = props.pt as number
  if (props.pr !== undefined) o.paddingRight = props.pr as number
  if (props.pb !== undefined) o.paddingBottom = props.pb as number
  if (props.pl !== undefined) o.paddingLeft = props.pl as number

  // Grow
  if (props.grow !== undefined) o.layoutGrow = props.grow as number

  // Min/max size — stored as-is, layout engine uses them
  if (props.minW !== undefined) o.width = Math.max(o.width ?? 0, props.minW as number)
  if (props.maxW !== undefined) o.width = Math.min(o.width ?? Infinity, props.maxW as number)

  // Text properties
  if (isText) {
    const fontSize = props.size ?? props.fontSize
    if (typeof fontSize === 'number') o.fontSize = fontSize

    const fontFamily = props.font ?? props.fontFamily
    if (typeof fontFamily === 'string') o.fontFamily = fontFamily

    const weight = props.weight ?? props.fontWeight
    if (typeof weight === 'number') {
      o.fontWeight = weight
    } else if (typeof weight === 'string') {
      o.fontWeight = WEIGHT_MAP[weight] ?? 400
    }

    if (typeof props.color === 'string') {
      o.fills = [parseFill(props.color)]
    }

    if (props.textAlign) {
      o.textAlignHorizontal = TEXT_ALIGN_MAP[props.textAlign as string] ?? 'LEFT'
    }

    if (props.textAutoResize) {
      o.textAutoResize = TEXT_AUTO_RESIZE_MAP[props.textAutoResize as string] ?? 'NONE'
    } else {
      // Default: auto-resize height for text nodes
      o.textAutoResize = 'HEIGHT'
    }
  }

  // Star-specific
  if (props.points !== undefined) o.pointCount = props.points as number
  if (props.innerRadius !== undefined) o.starInnerRadius = props.innerRadius as number

  // Polygon-specific
  if (props.pointCount !== undefined) o.pointCount = props.pointCount as number

  // Stroke align
  if (props.strokeAlign) {
    // Stored on the stroke itself, applied during rendering
  }

  // Effects: shadow and blur
  if (typeof props.shadow === 'string') {
    const parts = (props.shadow as string).split(/\s+/)
    if (parts.length >= 4) {
      const [x, y, blur, color] = [
        parseFloat(parts[0]!),
        parseFloat(parts[1]!),
        parseFloat(parts[2]!),
        parts.slice(3).join(' ')
      ]
      const c = parseColor(color)
      o.effects = [
        ...(o.effects ?? []),
        { type: 'DROP_SHADOW', color: c, offset: { x, y }, radius: blur, spread: 0, visible: true }
      ]
    }
  }
  if (typeof props.blur === 'number') {
    o.effects = [
      ...(o.effects ?? []),
      {
        type: 'LAYER_BLUR',
        radius: props.blur as number,
        visible: true,
        color: { r: 0, g: 0, b: 0, a: 0 },
        offset: { x: 0, y: 0 },
        spread: 0
      }
    ]
  }

  return o
}
