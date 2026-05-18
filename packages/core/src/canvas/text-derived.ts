import type { Canvas } from 'canvaskit-wasm'

import type { SceneNode } from '#core/scene-graph'
import { geometryBlobToPath } from '#core/vector'

import type { SkiaRenderer } from './renderer'

export function snapFigmaDerivedGlyphBaseline(y: number): number {
  return Math.round(y)
}

export function shouldUseHardFigmaDerivedGlyphCoverage(
  node: Pick<SceneNode, 'fontSize' | 'fontWeight'>
): boolean {
  return node.fontSize === 20 && node.fontWeight === 400
}

export function drawFigmaDerivedText(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode
): boolean {
  if (!node.figmaDerivedTextGlyphs?.length) return false

  for (const glyph of node.figmaDerivedTextGlyphs) {
    const path = geometryBlobToPath(r.ck, glyph.commandsBlob, 'NONZERO')
    canvas.save()
    canvas.translate(glyph.x, snapFigmaDerivedGlyphBaseline(glyph.y))
    canvas.scale(glyph.fontSize, -glyph.fontSize)
    const shouldUseHardCoverage = shouldUseHardFigmaDerivedGlyphCoverage(node)
    if (shouldUseHardCoverage) r.fillPaint.setAntiAlias(false)
    canvas.drawPath(path, r.fillPaint)
    if (shouldUseHardCoverage) r.fillPaint.setAntiAlias(true)
    canvas.restore()
    path.delete()
  }
  return true
}
