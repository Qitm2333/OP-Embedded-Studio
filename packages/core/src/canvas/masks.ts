import type { Canvas } from 'canvaskit-wasm'

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
  isVisibleMask: (childId: string) => boolean,
  renderChild: (childId: string) => void,
  renderMask: (childId: string) => void
): void {
  for (let index = 0; index < childIds.length; index++) {
    const childId = childIds[index]
    if (!isVisibleMask(childId)) {
      renderChild(childId)
      continue
    }

    const start = index + 1
    let end = start
    while (end < childIds.length && !isVisibleMask(childIds[end])) end++
    if (start === end) continue

    resetMaskPaint(r)
    canvas.save()
    canvas.saveLayer(r.effectLayerPaint)
    for (let maskedIndex = start; maskedIndex < end; maskedIndex++) renderChild(childIds[maskedIndex])

    resetMaskPaint(r)
    r.effectLayerPaint.setBlendMode(r.ck.BlendMode.DstIn)
    canvas.saveLayer(r.effectLayerPaint)
    renderMask(childId)
    canvas.restore()

    canvas.restore()
    canvas.restore()
    resetMaskPaint(r)
    index = end - 1
  }
}
