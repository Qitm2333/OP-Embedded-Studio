import { computeContentBounds } from '@open-pencil/core/io/formats/raster'

import type { EditorStore } from '@/app/editor/session'

interface CropBounds {
  x: number
  y: number
  width: number
  height: number
}

interface VisualBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function calculateEmbeddedFrameCrop(
  exportBounds: VisualBounds,
  bitmapSize: { width: number; height: number },
  frameBounds: CropBounds
): CropBounds {
  const exportWidth = exportBounds.maxX - exportBounds.minX
  const exportHeight = exportBounds.maxY - exportBounds.minY
  if (exportWidth <= 0 || exportHeight <= 0) throw new Error('Frame 导出边界无效')

  const scaleX = bitmapSize.width / exportWidth
  const scaleY = bitmapSize.height / exportHeight
  return {
    x: (frameBounds.x - exportBounds.minX) * scaleX,
    y: (frameBounds.y - exportBounds.minY) * scaleY,
    width: frameBounds.width * scaleX,
    height: frameBounds.height * scaleY
  }
}
function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('无法编码裁切后的 Frame'))
        return
      }
      void blob
        .arrayBuffer()
        .then((buffer) => resolve(new Uint8Array(buffer)))
        .catch(reject)
    }, 'image/png')
  })
}

export async function renderEmbeddedFramePng(
  store: EditorStore,
  frameId: string
): Promise<Uint8Array> {
  const frame = store.graph.getNode(frameId)
  if (frame?.type !== 'FRAME') throw new Error('嵌入式烘焙目标不是有效的 Frame')

  const exportBounds = computeContentBounds(store.graph, [frame.id])
  if (!exportBounds) throw new Error(`无法计算 Frame 可视边界：${frame.name}`)

  const data = await store.renderExportImage([frame.id], 1, 'PNG')
  if (!data) throw new Error(`无法渲染 Frame：${frame.name}`)

  const bitmap = await createImageBitmap(
    new Blob([Uint8Array.from(data).buffer], { type: 'image/png' })
  )
  try {
    const crop = calculateEmbeddedFrameCrop(
      exportBounds,
      bitmap,
      store.graph.getAbsoluteBounds(frame.id)
    )
    const outputWidth = Math.max(1, Math.round(frame.width))
    const outputHeight = Math.max(1, Math.round(frame.height))

    const canvas = document.createElement('canvas')
    canvas.width = outputWidth
    canvas.height = outputHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法创建嵌入式 Frame 裁切画布')

    // Normal export intentionally includes descendant visual overflow. Embedded
    // screens instead use the Frame rectangle as a fixed hardware viewport.
    context.clearRect(0, 0, outputWidth, outputHeight)
    context.drawImage(
      bitmap,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      outputWidth,
      outputHeight
    )
    return await canvasToPng(canvas)
  } finally {
    bitmap.close()
  }
}

export async function renderEmbeddedVisualPng(
  store: EditorStore,
  nodeId: string
): Promise<Uint8Array> {
  const node = store.graph.getNode(nodeId)
  if (!node) throw new Error('烧录来源已不存在，请重新选择画面')
  if (node.type === 'FRAME') return renderEmbeddedFramePng(store, node.id)

  const data = await store.renderExportImage([node.id], 1, 'PNG')
  if (!data) throw new Error(`无法渲染画面：${node.name}`)
  return data
}
