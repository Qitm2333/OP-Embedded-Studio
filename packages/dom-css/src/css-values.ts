import { colorToCSS, parseColor } from '@open-pencil/core/color'
import type { Fill, SceneNode } from '@open-pencil/core/scene-graph'
import type { Color } from '@open-pencil/core/types'

import type { DesignStyleDeclaration } from './types'

const TRANSPARENT_KEYWORDS = new Set(['transparent', 'rgba(0, 0, 0, 0)', 'rgb(0 0 0 / 0)'])

export function parseCSSNumber(value: string | undefined): number | null {
  if (!value) return null
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed === 'auto') return null
  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseCSSColor(value: string | undefined): Color | null {
  if (!value) return null
  const trimmed = value.trim()
  if (trimmed.length === 0 || TRANSPARENT_KEYWORDS.has(trimmed.toLowerCase())) return null
  return parseColor(trimmed)
}

export function fillToCSS(fill: Fill | undefined): string | undefined {
  if (fill?.type !== 'SOLID' || !fill.visible) return undefined
  return colorToCSS({ ...fill.color, a: fill.opacity })
}

export function colorToFillFromCSS(value: string | undefined): Fill[] {
  const color = parseCSSColor(value)
  if (!color) return []
  return [{ type: 'SOLID', color, opacity: color.a, visible: true }]
}

export function pickStyle(elementStyle: DesignStyleDeclaration | undefined, property: string) {
  return elementStyle?.[property]
}

export function mergedStyle(node: {
  inlineStyle?: DesignStyleDeclaration
  computedStyle?: DesignStyleDeclaration
}) {
  return { ...node.inlineStyle, ...node.computedStyle }
}

export function sceneNodeSizeStyle(node: SceneNode): DesignStyleDeclaration {
  const style: DesignStyleDeclaration = {}
  if (node.width > 0) style.width = `${node.width}px`
  if (node.height > 0) style.height = `${node.height}px`
  return style
}
