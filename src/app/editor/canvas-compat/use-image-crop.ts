import { useEventListener } from '@vueuse/core'
import type { Ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import type { Fill, SceneNode } from '@open-pencil/scene-graph'
import type { Mat3 } from '@open-pencil/scene-graph/matrix'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import { Matrix, nodeWorldMatrix, parentWorldMatrix } from './geometry'

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

interface CropDrag {
  nodeId: string
  fillIndex: number
  imageWidth: number
  imageHeight: number
  imageToWorld: Mat3
  original: Pick<SceneNode, 'x' | 'y' | 'width' | 'height' | 'fills'>
  startRect: Rect
  handle: ResizeHandle
  changed: boolean
}

const HANDLE_POINTS: Record<ResizeHandle, Vector> = {
  nw: { x: 0, y: 0 },
  n: { x: 0.5, y: 0 },
  ne: { x: 1, y: 0 },
  e: { x: 1, y: 0.5 },
  se: { x: 1, y: 1 },
  s: { x: 0.5, y: 1 },
  sw: { x: 0, y: 1 },
  w: { x: 0, y: 0.5 }
}

function eventWorldPoint(event: MouseEvent, canvas: HTMLCanvasElement, editor: Editor): Vector {
  const bounds = canvas.getBoundingClientRect()
  return editor.screenToCanvas(event.clientX - bounds.left, event.clientY - bounds.top)
}

function selectedImageNode(
  editor: Editor
): { node: SceneNode; fillIndex: number; fill: Fill } | null {
  if (editor.state.selectedIds.size !== 1) return null
  const id = [...editor.state.selectedIds][0]
  const node = editor.graph.getNode(id)
  if (!node || node.rotation !== 0 || node.flipX || node.flipY) return null
  const fillIndex = node.fills.findIndex(
    (fill) => fill.type === 'IMAGE' && fill.visible && !!fill.imageHash
  )
  if (fillIndex === -1) return null
  return { node, fillIndex, fill: node.fills[fillIndex] }
}

function hitResizeHandle(editor: Editor, node: SceneNode, point: Vector): ResizeHandle | null {
  const matrix = nodeWorldMatrix(editor.graph, node)
  const tolerance = 10 / editor.state.zoom
  let nearest: { handle: ResizeHandle; distance: number } | null = null

  for (const [handle, normalized] of Object.entries(HANDLE_POINTS) as Array<
    [ResizeHandle, Vector]
  >) {
    const handlePoint = Matrix.mapPoint(matrix, {
      x: normalized.x * node.width,
      y: normalized.y * node.height
    })
    const distance = Math.hypot(point.x - handlePoint.x, point.y - handlePoint.y)
    if (distance <= tolerance && (!nearest || distance < nearest.distance)) {
      nearest = { handle, distance }
    }
  }

  return nearest?.handle ?? null
}

function decodeImageSize(editor: Editor, hash: string): { width: number; height: number } | null {
  const bytes = editor.graph.images.get(hash)
  const ck = editor.renderer?.ck
  if (!bytes || !ck) return null
  const image = ck.MakeImageFromEncoded(bytes)
  if (!image) return null
  const size = { width: image.width(), height: image.height() }
  image.delete()
  return size
}

export function defaultImageLocalMatrix(
  fill: Fill,
  node: SceneNode,
  imageWidth: number,
  imageHeight: number
): Mat3 | null {
  if ((fill.imageScaleMode === 'CROP' || fill.imageScaleMode === 'TILE') && fill.imageTransform) {
    const transform = [
      fill.imageTransform.m00,
      fill.imageTransform.m01,
      fill.imageTransform.m02,
      fill.imageTransform.m10,
      fill.imageTransform.m11,
      fill.imageTransform.m12,
      0,
      0,
      1
    ]
    const inverse = Matrix.invert(transform)
    if (!inverse) return null
    return Matrix.multiply(
      Matrix.scaled(node.width, node.height),
      inverse,
      Matrix.scaled(1 / imageWidth, 1 / imageHeight)
    )
  }

  const fit = fill.imageScaleMode === 'FIT'
  const scale = fit
    ? Math.min(node.width / imageWidth, node.height / imageHeight)
    : Math.max(node.width / imageWidth, node.height / imageHeight)
  const sourceWidth = fit ? imageWidth : node.width / scale
  const sourceHeight = fit ? imageHeight : node.height / scale
  const sourceX = fit ? -(node.width / scale - imageWidth) / 2 : (imageWidth - sourceWidth) / 2
  const sourceY = fit ? -(node.height / scale - imageHeight) / 2 : (imageHeight - sourceHeight) / 2

  return Matrix.multiply(
    Matrix.scaled(node.width / sourceWidth, node.height / sourceHeight),
    Matrix.translated(-sourceX, -sourceY)
  )
}

export function resizedRect(start: Rect, handle: ResizeHandle, point: Vector): Rect {
  const minimum = 1
  let left = start.x
  let top = start.y
  let right = start.x + start.width
  let bottom = start.y + start.height

  if (handle.includes('w')) left = Math.min(point.x, right - minimum)
  if (handle.includes('e')) right = Math.max(point.x, left + minimum)
  if (handle.includes('n')) top = Math.min(point.y, bottom - minimum)
  if (handle.includes('s')) bottom = Math.max(point.y, top + minimum)

  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function imageTransformForRect(
  editor: Editor,
  node: SceneNode,
  rect: Rect,
  imageToWorld: Mat3,
  imageWidth: number,
  imageHeight: number
): NonNullable<Fill['imageTransform']> | null {
  const newNodeWorld = Matrix.multiply(
    parentWorldMatrix(editor.graph, node.parentId),
    Matrix.translated(rect.x, rect.y)
  )
  const inverseNodeWorld = Matrix.invert(newNodeWorld)
  if (!inverseNodeWorld) return null

  const inverseTransform = Matrix.multiply(
    Matrix.scaled(1 / rect.width, 1 / rect.height),
    inverseNodeWorld,
    imageToWorld,
    Matrix.scaled(imageWidth, imageHeight)
  )
  const transform = Matrix.invert(inverseTransform)
  if (!transform) return null

  return {
    m00: transform[0],
    m01: transform[1],
    m02: transform[2],
    m10: transform[3],
    m11: transform[4],
    m12: transform[5]
  }
}

export function useImageCropCompatibility(
  canvasRef: Ref<HTMLCanvasElement | null>,
  editor: Editor
): void {
  let drag: CropDrag | null = null

  function stopEvent(event: MouseEvent): void {
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  function onMouseDown(event: MouseEvent): void {
    const canvas = canvasRef.value
    if (!canvas || event.button !== 0 || !(event.ctrlKey || event.metaKey)) return
    const selected = selectedImageNode(editor)
    if (!selected || !selected.fill.imageHash) return
    const point = eventWorldPoint(event, canvas, editor)
    const handle = hitResizeHandle(editor, selected.node, point)
    if (!handle) return
    const imageSize = decodeImageSize(editor, selected.fill.imageHash)
    if (!imageSize) return
    const localMatrix = defaultImageLocalMatrix(
      selected.fill,
      selected.node,
      imageSize.width,
      imageSize.height
    )
    if (!localMatrix) return

    drag = {
      nodeId: selected.node.id,
      fillIndex: selected.fillIndex,
      imageWidth: imageSize.width,
      imageHeight: imageSize.height,
      imageToWorld: Matrix.multiply(nodeWorldMatrix(editor.graph, selected.node), localMatrix),
      original: {
        x: selected.node.x,
        y: selected.node.y,
        width: selected.node.width,
        height: selected.node.height,
        fills: structuredClone(selected.node.fills)
      },
      startRect: {
        x: selected.node.x,
        y: selected.node.y,
        width: selected.node.width,
        height: selected.node.height
      },
      handle,
      changed: false
    }
    stopEvent(event)
  }

  function onMouseMove(event: MouseEvent): void {
    const canvas = canvasRef.value
    if (!drag || !canvas) return
    const node = editor.graph.getNode(drag.nodeId)
    if (!node) {
      drag = null
      return
    }
    const parentInverse = Matrix.invert(parentWorldMatrix(editor.graph, node.parentId))
    if (!parentInverse) return
    const parentPoint = Matrix.mapPoint(parentInverse, eventWorldPoint(event, canvas, editor))
    const rect = resizedRect(drag.startRect, drag.handle, parentPoint)
    const imageTransform = imageTransformForRect(
      editor,
      node,
      rect,
      drag.imageToWorld,
      drag.imageWidth,
      drag.imageHeight
    )
    if (!imageTransform) return

    const fills = structuredClone(node.fills)
    fills[drag.fillIndex] = {
      ...fills[drag.fillIndex],
      imageScaleMode: 'CROP',
      imageTransform
    }
    editor.graph.updateNode(node.id, { ...rect, fills })
    editor.requestRender()
    drag.changed = true
    stopEvent(event)
  }

  function finishCrop(event?: MouseEvent): void {
    if (!drag) return
    const current = drag
    drag = null
    if (event) stopEvent(event)
    if (!current.changed || !editor.graph.getNode(current.nodeId)) return
    editor.commitNodeUpdate(current.nodeId, current.original, 'Crop image')
  }

  function cancelCrop(): void {
    if (!drag) return
    const current = drag
    drag = null
    if (editor.graph.getNode(current.nodeId)) {
      editor.graph.updateNode(current.nodeId, current.original)
      editor.requestRender()
    }
  }

  useEventListener(canvasRef, 'mousedown', onMouseDown, { capture: true })
  useEventListener(window, 'mousemove', onMouseMove, { capture: true })
  useEventListener(window, 'mouseup', finishCrop, { capture: true })
  useEventListener(window, 'keydown', (event) => {
    if (event.key === 'Escape' && drag) {
      event.preventDefault()
      cancelCrop()
    }
  })
}
