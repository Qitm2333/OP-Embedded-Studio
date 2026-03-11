import { colorDistance, colorToHex } from '../color'

import type { Color } from '../types'
import type { SceneGraph, SceneNode } from '../scene-graph'

const MIN_FILL_OPACITY = 0.15
const MIN_STROKE_OPACITY = 0.20
const LOW_CONTRAST_THRESHOLD = 15

export interface DescribeIssue {
  message: string
  suggestion?: string
}

function findAncestorBackground(node: SceneNode, graph: SceneGraph): Color | null {
  let current = node.parentId ? graph.getNode(node.parentId) : null
  while (current) {
    const solidFill = current.fills.find((f) => f.visible && f.type === 'SOLID' && f.opacity > 0.5)
    if (solidFill) return solidFill.color
    current = current.parentId ? graph.getNode(current.parentId) : null
  }
  return null
}

const CONTAINER_TYPES = new Set(['FRAME', 'COMPONENT', 'INSTANCE'])
const SHAPE_TYPES = new Set(['RECTANGLE', 'ELLIPSE', 'STAR', 'POLYGON', 'LINE'])
const ICON_MAX_SIZE = 48
const BUTTON_MAX_WIDTH = 200
const BUTTON_MAX_HEIGHT = 50
const BUTTON_MIN_HEIGHT = 28
const BUTTON_MIN_RADIUS = 2

function looksLikeButton(node: SceneNode): boolean {
  if (!CONTAINER_TYPES.has(node.type)) return false
  return node.width <= BUTTON_MAX_WIDTH &&
    node.height >= BUTTON_MIN_HEIGHT && node.height <= BUTTON_MAX_HEIGHT &&
    node.cornerRadius >= BUTTON_MIN_RADIUS &&
    node.childIds.length > 0
}

function checkEmptyIcon(node: SceneNode, graph: SceneGraph, issues: DescribeIssue[]): void {
  if (!CONTAINER_TYPES.has(node.type)) return
  if (node.width > ICON_MAX_SIZE || node.height > ICON_MAX_SIZE || node.childIds.length === 0) return
  if (node.fills.some((f) => f.visible) || node.strokes.some((s) => s.visible)) return

  const hasVisibleChild = node.childIds.some((id) => {
    const c = graph.getNode(id)
    return c?.visible && (c.fills.some((f) => f.visible) || c.strokes.some((s) => s.visible) || c.type === 'TEXT')
  })
  if (!hasVisibleChild) {
    issues.push({
      message: `Icon-sized frame "${node.name}" (${node.width}×${node.height}) has no visible content`,
      suggestion: 'Add bg="#hex" or stroke="#hex" to the icon or its children'
    })
  }
}

function detectStructuralIssues(node: SceneNode, gridSize: number, graph: SceneGraph, issues: DescribeIssue[]): void {
  if (node.x % 1 !== 0 || node.y % 1 !== 0) {
    issues.push({
      message: `Subpixel position (${node.x}, ${node.y})`,
      suggestion: `(${Math.round(node.x)}, ${Math.round(node.y)})`
    })
  }
  if (CONTAINER_TYPES.has(node.type) && node.fills.length === 0 && node.childIds.length === 0) {
    issues.push({ message: 'Empty frame with no fill' })
  }
  const hasVisibleFill = node.fills.some((f) => f.visible)
  const hasVisibleStroke = node.strokes.some((s) => s.visible)
  if (SHAPE_TYPES.has(node.type) && !hasVisibleFill && !hasVisibleStroke) {
    issues.push({
      message: `${node.type} "${node.name}" has no fill and no stroke — invisible`,
      suggestion: 'Add bg="#hex" or stroke="#hex"'
    })
  }
  checkEmptyIcon(node, graph, issues)
  if (looksLikeButton(node) && node.width < 44) {
    issues.push({ message: `Touch target too small (${node.width}×${node.height})`, suggestion: 'Min 44×44' })
  }
  if (node.itemSpacing > 0 && node.itemSpacing % gridSize !== 0) {
    const nearest = Math.round(node.itemSpacing / gridSize) * gridSize
    issues.push({ message: `Gap ${node.itemSpacing} not on ${gridSize}px grid`, suggestion: `${nearest}` })
  }
}

function detectVisibilityIssues(node: SceneNode, graph: SceneGraph, issues: DescribeIssue[]): void {
  for (const fill of node.fills) {
    if (!fill.visible || fill.type !== 'SOLID') continue
    if (fill.opacity < MIN_FILL_OPACITY) {
      issues.push({
        message: `Near-invisible fill ${colorToHex(fill.color)} at ${Math.round(fill.opacity * 100)}% opacity`,
        suggestion: `Increase to at least ${Math.round(MIN_FILL_OPACITY * 100)}%`
      })
    }
  }
  for (const stroke of node.strokes) {
    if (!stroke.visible || stroke.opacity >= MIN_STROKE_OPACITY) continue
    issues.push({
      message: `Near-invisible stroke at ${Math.round(stroke.opacity * 100)}% opacity`,
      suggestion: `Increase to at least ${Math.round(MIN_STROKE_OPACITY * 100)}%`
    })
  }
  if (node.type !== 'TEXT' || !node.parentId) return
  const textFill = node.fills.find((f) => f.visible && f.type === 'SOLID')
  if (!textFill) return
  const parentBg = findAncestorBackground(node, graph)
  if (!parentBg) return
  const dist = colorDistance(textFill.color, parentBg)
  if (dist < LOW_CONTRAST_THRESHOLD) {
    issues.push({
      message: `Low contrast: text ${colorToHex(textFill.color)} on ${colorToHex(parentBg)} (distance ${Math.round(dist)})`,
      suggestion: 'Increase color difference between text and background'
    })
  }
}

const DARK_BG_LUMINANCE = 0.35

function rgbLuminance(c: Color): number {
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b
}

interface LayoutContext {
  node: SceneNode
  graph: SceneGraph
  isRow: boolean
  children: SceneNode[]
  issues: DescribeIssue[]
}

function checkDividerOrientation(ctx: LayoutContext): void {
  for (const child of ctx.children) {
    const isVerticalDivider = child.width <= 2 && child.height > 10 && child.type === 'RECTANGLE'
    const isHorizontalDivider = child.height <= 2 && child.width > 10 && child.type === 'RECTANGLE'
    if (isVerticalDivider && !ctx.isRow) {
      ctx.issues.push({
        message: `Vertical divider "${child.name}" (${child.width}×${child.height}) is inside a column layout — should be inside flex="row"`,
        suggestion: 'Move the divider inside the row container it separates, or change to a horizontal divider'
      })
    }
    if (isHorizontalDivider && ctx.isRow) {
      ctx.issues.push({
        message: `Horizontal divider "${child.name}" (${child.width}×${child.height}) is inside a row layout — should be inside flex="col"`,
        suggestion: 'Move the divider inside the column container it separates'
      })
    }
  }
}

function checkGrowInHug(ctx: LayoutContext): void {
  const { node, isRow, children, issues } = ctx
  if (node.primaryAxisSizing !== 'HUG') return
  for (const child of children) {
    if (child.layoutGrow > 0) {
      issues.push({
        message: `"${child.name}" has grow=${child.layoutGrow} but parent "${node.name}" is HUG on ${isRow ? 'horizontal' : 'vertical'} axis`,
        suggestion: `Set parent to fixed size, or remove grow from "${child.name}"`
      })
    }
  }
}

function checkGrowSizeConflict(ctx: LayoutContext): void {
  for (const child of ctx.children) {
    if (child.layoutGrow > 0 && child.layoutMode === 'NONE') {
      const fixedDim = ctx.isRow ? child.width : child.height
      if (fixedDim > 0 && fixedDim !== 100) {
        ctx.issues.push({
          message: `"${child.name}" has both fixed ${ctx.isRow ? 'width' : 'height'}=${fixedDim} and grow=${child.layoutGrow} — grow overrides the size`,
          suggestion: 'Remove the fixed size or remove grow'
        })
      }
    }
  }
}

function checkChildOverflow(ctx: LayoutContext): void {
  const { node, graph, isRow, children, issues } = ctx
  for (const child of children) {
    if (child.layoutPositioning === 'ABSOLUTE') continue
    for (const grandchildId of child.childIds) {
      const gc = graph.getNode(grandchildId)
      if (!gc?.visible) continue
      const gcDim = isRow ? gc.width : gc.height
      const parentDim = isRow ? child.width : child.height
      if (gcDim > parentDim + 1 && !child.clipsContent && parentDim > 0) {
        issues.push({
          message: `"${gc.name}" (${Math.round(gcDim)}px) overflows parent "${child.name}" (${Math.round(parentDim)}px)`,
          suggestion: `Reduce size or add overflow="hidden" on "${child.name}"`
        })
      }
    }
  }

  if (node.primaryAxisSizing === 'FIXED' && !node.clipsContent) {
    const pad = isRow
      ? node.paddingLeft + node.paddingRight
      : node.paddingTop + node.paddingBottom
    const spacing = children.length > 1 ? (children.length - 1) * node.itemSpacing : 0
    const available = (isRow ? node.width : node.height) - pad - spacing
    let totalChildren = 0
    for (const child of children) {
      totalChildren += isRow ? child.width : child.height
    }
    if (totalChildren > available + 1) {
      issues.push({
        message: `Children total ${Math.round(totalChildren)}px exceeds available ${Math.round(available)}px on ${isRow ? 'horizontal' : 'vertical'} axis`,
        suggestion: 'Use grow/fill for flexible sizing, reduce child sizes, or set overflow="hidden"'
      })
    }
  }
}

function checkHugCollapse(ctx: LayoutContext): void {
  const { node, isRow, children, issues } = ctx
  if (children.length === 0) return

  if (node.primaryAxisSizing === 'HUG') {
    const allGrow = children.every((c) => c.layoutGrow > 0)
    if (allGrow) {
      issues.push({
        message: `"${node.name}" is HUG but all children use grow — no child provides a concrete size`,
        suggestion: 'Give at least one child a fixed size, or set parent to fixed size'
      })
    }
  }
  if (node.counterAxisSizing === 'HUG') {
    const allStretch = children.every(
      (c) => c.layoutAlignSelf === 'STRETCH' || (node.counterAxisAlign === 'STRETCH' && c.layoutAlignSelf === 'AUTO')
    )
    const noConcreteChild = children.every((c) => {
      const dim = isRow ? c.height : c.width
      return dim <= 0
    })
    if (allStretch && noConcreteChild) {
      issues.push({
        message: `"${node.name}" is HUG on cross axis but all children stretch — no child provides a concrete size`,
        suggestion: 'Give at least one child a fixed cross-axis size, or set parent cross-axis to fixed'
      })
    }
  }
}

function checkTextVisibility(ctx: LayoutContext): void {
  const { node, graph, issues } = ctx
  for (const childId of node.childIds) {
    const child = graph.getNode(childId)
    if (!child?.visible || child.type !== 'TEXT') continue
    const textFill = child.fills.find((f) => f.visible && f.type === 'SOLID')
    if (!textFill) {
      issues.push({
        message: `"${child.name || child.text.slice(0, 20) || 'Text'}" has no color — invisible`,
        suggestion: 'Add color="#hex" to the Text element'
      })
      continue
    }
    const textLum = rgbLuminance(textFill.color)
    if (textLum > DARK_BG_LUMINANCE) continue
    const bg = findAncestorBackground(child, graph)
    if (!bg) continue
    if (rgbLuminance(bg) < DARK_BG_LUMINANCE) {
      issues.push({
        message: `"${child.name || child.text.slice(0, 20) || 'Text'}" is dark text (${colorToHex(textFill.color)}) on dark background (${colorToHex(bg)})`,
        suggestion: 'Set an explicit light color on the text'
      })
    }
  }
}

function checkTextOverflow(ctx: LayoutContext): void {
  const { node, children, issues } = ctx
  const parentAvailableW = node.width - node.paddingLeft - node.paddingRight
  for (const child of children) {
    if (child.type !== 'TEXT' || !child.visible) continue
    if (child.textAutoResize === 'WIDTH_AND_HEIGHT' && child.width > parentAvailableW + 1) {
      issues.push({
        message: `Text "${child.text.slice(0, 25)}..." is ${Math.round(child.width)}px wide but parent "${node.name}" has ${Math.round(parentAvailableW)}px available`,
        suggestion: `Add w={${Math.round(parentAvailableW)}} to the Text or use w="fill"`
      })
    }
  }
}

function checkCrossAxisOverflow(ctx: LayoutContext): void {
  const { node, isRow, children, issues } = ctx
  if (node.clipsContent) return
  const crossPad = isRow
    ? node.paddingTop + node.paddingBottom
    : node.paddingLeft + node.paddingRight
  const crossAvailable = (isRow ? node.height : node.width) - crossPad
  for (const child of children) {
    const childCross = isRow ? child.height : child.width
    if (childCross > crossAvailable + 1 && child.layoutAlignSelf !== 'STRETCH') {
      issues.push({
        message: `"${child.name}" is ${Math.round(childCross)}px on cross axis but parent has ${Math.round(crossAvailable)}px available`,
        suggestion: 'Reduce child size, use fill sizing, or set overflow="hidden" on parent'
      })
    }
  }
}

function detectLayoutIssues(node: SceneNode, graph: SceneGraph, issues: DescribeIssue[]): void {
  if (!CONTAINER_TYPES.has(node.type)) return

  const isAutoLayout = node.layoutMode !== 'NONE'
  const isRow = node.layoutMode === 'HORIZONTAL'
  const children = node.childIds
    .map((id) => graph.getNode(id))
    .filter((c): c is SceneNode => c?.visible === true && c.layoutPositioning !== 'ABSOLUTE')

  const ctx: LayoutContext = { node, graph, isRow, children, issues }

  checkTextVisibility(ctx)
  if (!isAutoLayout) return

  if (node.layoutWrap === 'WRAP' && node.counterAxisSpacing <= 0 && children.length > 1) {
    issues.push({
      message: `"${node.name}" uses wrap but has no rowGap — wrapped rows will stick together`,
      suggestion: 'Add rowGap={8} or similar spacing'
    })
  }

  checkDividerOrientation(ctx)
  checkGrowInHug(ctx)
  checkGrowSizeConflict(ctx)
  checkChildOverflow(ctx)
  checkHugCollapse(ctx)
  checkTextOverflow(ctx)
  checkCrossAxisOverflow(ctx)
}

const RADIUS_TOLERANCE = 2

function detectRadiusIssues(node: SceneNode, graph: SceneGraph, issues: DescribeIssue[]): void {
  if (node.cornerRadius <= 0 || node.layoutMode === 'NONE') return

  const minPad = Math.min(node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft)
  if (minPad <= 0) return
  const expectedInner = Math.max(0, node.cornerRadius - minPad)

  for (const childId of node.childIds) {
    const child = graph.getNode(childId)
    if (!child?.visible || child.cornerRadius <= 0) continue
    if (child.layoutPositioning === 'ABSOLUTE') continue
    if (child.cornerRadius > node.cornerRadius + RADIUS_TOLERANCE) {
      issues.push({
        message: `"${child.name}" radius ${child.cornerRadius} exceeds parent "${node.name}" radius ${node.cornerRadius}`,
        suggestion: `Use rounded={${expectedInner}} (parent ${node.cornerRadius} − padding ${minPad})`
      })
    } else if (child.cornerRadius > expectedInner + RADIUS_TOLERANCE && expectedInner < node.cornerRadius) {
      issues.push({
        message: `"${child.name}" radius ${child.cornerRadius} should be ${expectedInner} (parent ${node.cornerRadius} − padding ${minPad})`,
        suggestion: `Use rounded={${expectedInner}}`
      })
    }
  }
}

const UPPERCASE_MAX_SIZE = 13

function detectTypographyIssues(node: SceneNode, graph: SceneGraph, issues: DescribeIssue[]): void {
  for (const childId of node.childIds) {
    const child = graph.getNode(childId)
    if (child?.type !== 'TEXT' || !child.visible) continue
    const text = child.text

    if (text === text.toUpperCase() && text.length > 1 && /[A-ZА-ЯЁ]/.test(text) && child.fontSize > UPPERCASE_MAX_SIZE) {
      issues.push({
        message: `"${text.slice(0, 30)}" is uppercase at ${child.fontSize}px — uppercase is for small labels (≤${UPPERCASE_MAX_SIZE}px)`,
        suggestion: `Reduce size to ≤${UPPERCASE_MAX_SIZE}px or use mixed case`
      })
    }
  }
}

const SPACING_GRID = 4

function detectSpacingIssues(node: SceneNode, graph: SceneGraph, gridSize: number, issues: DescribeIssue[]): void {
  if (node.layoutMode === 'NONE') return

  const children = node.childIds
    .map((id) => graph.getNode(id))
    .filter((c): c is SceneNode => c?.visible === true && c.layoutPositioning !== 'ABSOLUTE')

  const minPad = Math.min(node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft)
  if (node.itemSpacing > 0 && minPad > 0 && node.itemSpacing > minPad * 2) {
    issues.push({
      message: `Gap ${node.itemSpacing} is much larger than padding ${minPad} in "${node.name}"`,
      suggestion: 'Gap should usually be ≤ padding'
    })
  }

  const spacingValues = [node.itemSpacing, node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft]
    .filter((v) => v > 0)
  for (const v of spacingValues) {
    if (v % SPACING_GRID !== 0) {
      const nearest = Math.round(v / SPACING_GRID) * SPACING_GRID
      issues.push({
        message: `Spacing value ${v} in "${node.name}" is not on ${SPACING_GRID}px grid`,
        suggestion: `Use ${nearest}`
      })
      break
    }
  }

  const flexChildren = children.filter((c) => c.layoutMode !== 'NONE')
  if (flexChildren.length >= 2) {
    const paddings = flexChildren.map((c) => c.paddingTop + c.paddingRight + c.paddingBottom + c.paddingLeft)
    const gaps = flexChildren.map((c) => c.itemSpacing)
    const uniquePads = new Set(paddings)
    const uniqueGaps = new Set(gaps.filter((g) => g > 0))
    if (uniquePads.size > 2) {
      issues.push({
        message: `Inconsistent padding across sibling containers in "${node.name}" (${[...uniquePads].join(', ')})`,
        suggestion: 'Use the same padding for similar containers'
      })
    }
    if (uniqueGaps.size > 2) {
      issues.push({
        message: `Inconsistent gaps across sibling containers in "${node.name}" (${[...uniqueGaps].join(', ')})`,
        suggestion: 'Use the same gap for similar containers'
      })
    }
  }
}

export function detectIssues(node: SceneNode, gridSize: number, graph: SceneGraph): DescribeIssue[] {
  const issues: DescribeIssue[] = []
  detectStructuralIssues(node, gridSize, graph, issues)
  detectVisibilityIssues(node, graph, issues)
  detectLayoutIssues(node, graph, issues)
  detectRadiusIssues(node, graph, issues)
  detectTypographyIssues(node, graph, issues)
  detectSpacingIssues(node, graph, gridSize, issues)
  return issues
}
