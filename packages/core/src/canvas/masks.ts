import type { Canvas } from 'canvaskit-wasm'

import type { MaskType } from '#core/scene-graph'

import type { SkiaRenderer } from './renderer'

function resetMaskPaint(r: SkiaRenderer): void {
  r.effectLayerPaint.setImageFilter(null)
  r.effectLayerPaint.setColorFilter(null)
  r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)
}

export function renderMaskedChildIds(
  r: SkiaRenderer,
  canvas: Canvas,
  childIds: string[],
  getVisibleMaskType: (childId: string) => MaskType | null,
  renderChild: (childId: string) => void,
  renderMask: (childId: string) => void
): void {
  for (let index = 0; index < childIds.length; index++) {
    const childId = childIds[index]
    const maskType = getVisibleMaskType(childId)
    if (!maskType) {
      renderChild(childId)
      continue
    }

    const start = index + 1
    let end = start
    while (end < childIds.length && !getVisibleMaskType(childIds[end])) end++
    if (start === end) continue

    const lumaFilter = maskType === 'LUMINANCE' ? r.ck.ColorFilter.MakeLuma() : null
    try {
      resetMaskPaint(r)
      canvas.save()
      canvas.saveLayer(r.effectLayerPaint)
      for (let maskedIndex = start; maskedIndex < end; maskedIndex++)
        renderChild(childIds[maskedIndex])

      resetMaskPaint(r)
      r.effectLayerPaint.setBlendMode(r.ck.BlendMode.DstIn)
      if (lumaFilter) r.effectLayerPaint.setColorFilter(lumaFilter)
      canvas.saveLayer(r.effectLayerPaint)
      renderMask(childId)
      canvas.restore()

      canvas.restore()
      canvas.restore()
    } finally {
      resetMaskPaint(r)
      lumaFilter?.delete()
    }
    index = end - 1
  }
}
