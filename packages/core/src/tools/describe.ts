import { colorToHex } from '../color'

import { detectIssues } from './describe-issues'
import { defineTool } from './schema'

import type { SceneGraph, SceneNode } from '../scene-graph'

const NAME_ROLE_PATTERNS: { pattern: RegExp; role: string }[] = [
  { pattern: /^button$/i, role: 'button' },
  { pattern: /^btn[-_\s]/i, role: 'button' },
  { pattern: /[-_\s]btn$/i, role: 'button' },
  { pattern: /^cta$/i, role: 'button' },
  { pattern: /^icon[-_]?button$/i, role: 'button' },
  { pattern: /^link$/i, role: 'link' },
  { pattern: /^text[-_]?link$/i, role: 'link' },
  { pattern: /^input$/i, role: 'textbox' },
  { pattern: /^text[-_]?field$/i, role: 'textbox' },
  { pattern: /^search$/i, role: 'searchbox' },
  { pattern: /^checkbox$/i, role: 'checkbox' },
  { pattern: /^toggle$/i, role: 'switch' },
  { pattern: /^switch$/i, role: 'switch' },
  { pattern: /^radio$/i, role: 'radio' },
  { pattern: /^select$/i, role: 'combobox' },
  { pattern: /^dropdown$/i, role: 'combobox' },
  { pattern: /^slider$/i, role: 'slider' },
  { pattern: /^tab$/i, role: 'tab' },
  { pattern: /^tabs$/i, role: 'tablist' },
  { pattern: /^nav(bar|igation)?$/i, role: 'navigation' },
  { pattern: /^header$/i, role: 'banner' },
  { pattern: /^footer$/i, role: 'contentinfo' },
  { pattern: /^sidebar$/i, role: 'complementary' },
  { pattern: /^modal$/i, role: 'dialog' },
  { pattern: /^dialog$/i, role: 'dialog' },
  { pattern: /^tooltip$/i, role: 'tooltip' },
  { pattern: /^card$/i, role: 'article' },
  { pattern: /^avatar$/i, role: 'img' },
  { pattern: /^badge$/i, role: 'status' },
  { pattern: /^toast$/i, role: 'alert' },
  { pattern: /^alert$/i, role: 'alert' },
  { pattern: /^list$/i, role: 'list' },
  { pattern: /^menu$/i, role: 'menu' },
  { pattern: /^breadcrumb/i, role: 'navigation' },
  { pattern: /^progress$/i, role: 'progressbar' },
  { pattern: /^spinner$/i, role: 'progressbar' },
  { pattern: /^divider$/i, role: 'separator' },
  { pattern: /^separator$/i, role: 'separator' },
]

function detectRoleFromName(name: string): string | null {
  const base = (name.split(/[/,=]/)[0] ?? name).trim()
  for (const { pattern, role } of NAME_ROLE_PATTERNS) {
    if (pattern.test(base)) return role
  }
  return null
}

function headingLevel(fontSize: number): number | null {
  if (fontSize >= 32) return 1
  if (fontSize >= 24) return 2
  if (fontSize >= 20) return 3
  if (fontSize >= 18) return 4
  return null
}

function looksLikeSeparator(node: SceneNode): boolean {
  if (node.width <= 2 && node.height > 10) return true
  if (node.height <= 2 && node.width > 10) return true
  const ratio = Math.max(node.width, node.height) / Math.max(1, Math.min(node.width, node.height))
  return ratio > 10 && Math.min(node.width, node.height) <= 4
}

const BUTTON_MAX_WIDTH = 200
const BUTTON_MAX_HEIGHT = 50
const BUTTON_MIN_HEIGHT = 28
const BUTTON_MIN_RADIUS = 2

function looksLikeButton(node: SceneNode): boolean {
  if (node.type !== 'FRAME' && node.type !== 'COMPONENT' && node.type !== 'INSTANCE') return false
  if (node.width > BUTTON_MAX_WIDTH || node.height > BUTTON_MAX_HEIGHT || node.height < BUTTON_MIN_HEIGHT) return false
  if (node.fills.length === 0 && node.strokes.length === 0) return false
  if (node.cornerRadius < BUTTON_MIN_RADIUS) return false
  return node.childIds.length > 0
}

function describeVisual(node: SceneNode): string {
  const parts: string[] = []
  const fill = node.fills.find((f) => f.type === 'SOLID' && f.visible)
  if (fill) parts.push(`${colorToHex(fill.color)} fill`)
  if (node.strokes.length > 0 && node.strokes[0]?.visible) parts.push('bordered')
  if (node.cornerRadius > 0) parts.push('rounded')
  if (node.clipsContent) parts.push('clipped')
  for (const e of node.effects) {
    if (!e.visible) continue
    if (e.type === 'DROP_SHADOW') parts.push('drop shadow')
    else if (e.type === 'INNER_SHADOW') parts.push('inner shadow')
    else if (e.type === 'LAYER_BLUR' || e.type === 'FOREGROUND_BLUR') parts.push('blurred')
    else parts.push('backdrop blur')
  }
  return parts.join(', ') || 'no visual styles'
}

function describeLayout(node: SceneNode): string | null {
  if (node.layoutMode === 'NONE') return null
  const dir = node.layoutMode === 'HORIZONTAL' ? 'horizontal' : 'vertical'
  const parts = [dir]
  if (node.itemSpacing > 0) parts.push(`${node.itemSpacing}px gap`)
  const pad = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft]
  const allSame = pad.every((p) => p === pad[0])
  const first = pad[0]
  if (allSame && first > 0) parts.push(`${first}px padding`)
  else if (pad.some((p) => p > 0)) parts.push(`padding ${pad.join('/')}`)
  if (node.layoutWrap === 'WRAP') parts.push('wrap')
  return parts.join(', ')
}

function detectRole(node: SceneNode): string {
  const nameDetected = detectRoleFromName(node.name)
  if (nameDetected) return nameDetected
  if (node.type === 'TEXT') {
    const level = headingLevel(node.fontSize)
    return level ? `heading(${level})` : 'StaticText'
  }
  if (looksLikeSeparator(node)) return 'separator'
  if (looksLikeButton(node)) return 'button'
  return 'generic'
}

interface ChildDescription {
  role: string
  name: string
  summary: string
  id: string
  children?: ChildDescription[]
}

function describeChild(node: SceneNode, graph: SceneGraph, depth: number, gridSize: number): ChildDescription {
  const role = detectRole(node)
  let summary = ''
  if (node.type === 'TEXT') {
    const text = node.text.slice(0, 60)
    summary = `"${text}" ${node.fontSize}px ${node.fontFamily}`
    if (node.fontWeight >= 700) summary += ' bold'
    else if (node.fontWeight >= 500) summary += ' medium'
    const textColor = node.fills.find((f) => f.type === 'SOLID' && f.visible)
    if (textColor) summary += `, ${colorToHex(textColor.color)}`
  } else {
    summary = `${node.width}×${node.height}`
    const fill = node.fills.find((f) => f.type === 'SOLID' && f.visible)
    if (fill) summary += `, ${colorToHex(fill.color)}`
    if (node.cornerRadius > 0) summary += ', rounded'
  }
  const result: ChildDescription = { role, name: node.name, summary, id: node.id }

  if (depth > 0 && node.childIds.length > 0) {
    const kids: ChildDescription[] = []
    for (const childId of node.childIds) {
      const child = graph.getNode(childId)
      if (!child || !child.visible) continue
      kids.push(describeChild(child, graph, depth - 1, gridSize))
    }
    if (kids.length > 0) result.children = kids
  }
  return result
}

export const describe = defineTool({
  name: 'describe',
  description:
    'Semantic description of a node: role, visual style, layout, children summary, and design issues. Use depth=2 to see grandchildren (recommended for root frames).',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    depth: { type: 'number', description: 'How many levels of children to include (default: 1, max: 3)' },
    grid: { type: 'number', description: 'Grid size for alignment checks (default: 8)' }
  },
  execute: (figma, args) => {
    const gridSize = args.grid ?? 8
    const depth = Math.min(args.depth ?? 1, 3)
    const raw = figma.graph.getNode(args.id)
    if (!raw) return { error: `Node "${args.id}" not found` }

    const role = detectRole(raw)
    const visual = describeVisual(raw)
    const layout = describeLayout(raw)
    const issues = detectIssues(raw, gridSize, figma.graph)

    const children: ChildDescription[] = []
    for (const childId of raw.childIds) {
      const child = figma.graph.getNode(childId)
      if (!child || !child.visible) continue
      children.push(describeChild(child, figma.graph, depth - 1, gridSize))
    }

    const result: Record<string, unknown> = {
      id: raw.id,
      name: raw.name,
      type: raw.type,
      role,
      size: `${raw.width}×${raw.height}`,
      visual,
    }
    if (layout) result.layout = layout
    if (children.length > 0) result.children = children
    if (issues.length > 0) result.issues = issues

    return result
  }
})
