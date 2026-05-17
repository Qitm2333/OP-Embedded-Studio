import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext'

import type { SceneNode } from '#core/scene-graph'
import { fontManager, weightToStyle } from '#core/text/fonts'
import { getGlyphOutlineMetricsSync, type OutlineCommand } from '#core/text/opentype'

export type TextOutlineUnsupportedReason =
  | 'not-text'
  | 'empty-text'
  | 'missing-font'
  | 'complex-script'
  | 'style-runs'

export type TextOutlineSupport =
  | { supported: true }
  | { supported: false; reason: TextOutlineUnsupportedReason }

export interface TextOutlineGlyph {
  commands: OutlineCommand[]
  x: number
  y: number
}

export interface TextOutlineLayout {
  glyphs: TextOutlineGlyph[]
  width: number
  height: number
}

const COMPLEX_SCRIPT_PATTERN = /[\u0590-\u08ff\u0900-\u0dff\ufb1d-\ufdff\ufe70-\ufeff]/

function textStyle(node: SceneNode): string {
  return weightToStyle(node.fontWeight, node.italic)
}

function textFamily(node: SceneNode): string {
  return node.fontFamily
}

export function getTextOutlineSupport(node: SceneNode): TextOutlineSupport {
  if (node.type !== 'TEXT') return { supported: false, reason: 'not-text' }
  if (!node.text) return { supported: false, reason: 'empty-text' }
  if (node.styleRuns.length > 0) return { supported: false, reason: 'style-runs' }
  if (COMPLEX_SCRIPT_PATTERN.test(node.text)) return { supported: false, reason: 'complex-script' }
  if (!fontManager.loadedData(textFamily(node), textStyle(node))) {
    return { supported: false, reason: 'missing-font' }
  }
  return { supported: true }
}

function lineHeight(node: SceneNode): number {
  return node.lineHeight ?? Math.ceil(node.fontSize * 1.2)
}

function textLines(node: SceneNode): string[] {
  const hardLines = node.text.split('\n')
  if (node.textAutoResize === 'WIDTH_AND_HEIGHT') return hardLines

  const result: string[] = []
  for (const hardLine of hardLines) {
    if (!hardLine) {
      result.push('')
      continue
    }
    try {
      const prepared = prepareWithSegments(hardLine, `${node.fontSize}px ${node.fontFamily}`)
      const layout = layoutWithLines(prepared, node.width, lineHeight(node))
      result.push(...layout.lines.map((line) => line.text))
    } catch {
      result.push(hardLine)
    }
  }
  return result
}

function lineOffsetX(node: SceneNode, width: number): number {
  switch (node.textAlignHorizontal) {
    case 'CENTER':
      return Math.max(0, (node.width - width) / 2)
    case 'RIGHT':
      return Math.max(0, node.width - width)
    default:
      return 0
  }
}

function verticalOffset(node: SceneNode, contentHeight: number): number {
  switch (node.textAlignVertical) {
    case 'CENTER':
      return Math.max(0, (node.height - contentHeight) / 2)
    case 'BOTTOM':
      return Math.max(0, node.height - contentHeight)
    default:
      return 0
  }
}

export function textNodeToOutlineLayout(node: SceneNode): TextOutlineLayout | null {
  if (!getTextOutlineSupport(node).supported) return null

  const lines = textLines(node)
  const lineH = lineHeight(node)
  const contentHeight = lines.length * lineH
  const yOffset = verticalOffset(node, contentHeight)
  const glyphs: TextOutlineGlyph[] = []
  let maxWidth = 0

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]
    const metrics = getGlyphOutlineMetricsSync(textFamily(node), textStyle(node), line, node.fontSize)
    if (!metrics) return null

    const lineWidth = metrics.reduce((width, glyph) => width + glyph.advance + node.letterSpacing, 0)
    maxWidth = Math.max(maxWidth, lineWidth)
    const xOffset = lineOffsetX(node, lineWidth)
    const baseline = yOffset + lineIndex * lineH + lineH

    let cursorX = xOffset
    for (const glyph of metrics) {
      glyphs.push({ commands: glyph.commands, x: cursorX, y: baseline })
      cursorX += glyph.advance + node.letterSpacing
    }
  }

  return { glyphs, width: maxWidth, height: contentHeight }
}
