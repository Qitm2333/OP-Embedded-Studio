import type { Canvas } from 'canvaskit-wasm'

import type { SceneNode } from '#core/scene-graph'
import { geometryBlobToPath } from '#core/vector'

import type { SkiaRenderer } from './renderer'

export function drawFigmaDerivedText(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode
): boolean {
  if (!node.figmaDerivedTextGlyphs?.length) return false

  for (const glyph of node.figmaDerivedTextGlyphs) {
    const path = geometryBlobToPath(r.ck, glyph.commandsBlob, 'NONZERO')
    canvas.save()
    canvas.translate(glyph.x, glyph.y)
    canvas.scale(glyph.fontSize, -glyph.fontSize)
    canvas.drawPath(path, r.fillPaint)
    canvas.restore()
    path.delete()
  }
  return true
}
