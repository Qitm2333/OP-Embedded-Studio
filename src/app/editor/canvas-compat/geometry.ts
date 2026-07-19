import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix, { type Mat3 } from '@open-pencil/scene-graph/matrix'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

export { Matrix }
export type { Mat3 }

export function nodeWorldMatrix(graph: SceneGraph, node: SceneNode): Mat3 {
  return getWorldMatrix(node, graph)
}

export function parentWorldMatrix(graph: SceneGraph, parentId: string | null): Mat3 {
  if (!parentId) return Matrix.identity()
  const parent = graph.getNode(parentId)
  return parent && parent.type !== 'CANVAS' ? getWorldMatrix(parent, graph) : Matrix.identity()
}

export function worldCenter(graph: SceneGraph, node: SceneNode): Vector {
  return Matrix.mapPoint(getWorldMatrix(node, graph), {
    x: node.width / 2,
    y: node.height / 2
  })
}

export function worldRotation(graph: SceneGraph, node: SceneNode): number {
  const matrix = getWorldMatrix(node, graph)
  return (Math.atan2(matrix[3], matrix[0]) * 180) / Math.PI
}

export function normalizeRotation(value: number): number {
  let normalized = value % 360
  if (normalized > 180) normalized -= 360
  if (normalized <= -180) normalized += 360
  return normalized
}

export function localRectForWorldCenter(
  graph: SceneGraph,
  parentId: string | null,
  center: Vector,
  width: number,
  height: number
): Pick<Rect, 'x' | 'y'> | null {
  const inverse = Matrix.invert(parentWorldMatrix(graph, parentId))
  if (!inverse) return null
  const localCenter = Matrix.mapPoint(inverse, center)
  return { x: localCenter.x - width / 2, y: localCenter.y - height / 2 }
}

export function worldBounds(graph: SceneGraph, node: SceneNode): Rect {
  const points = Matrix.mapPoints(getWorldMatrix(node, graph), [
    0,
    0,
    node.width,
    0,
    node.width,
    node.height,
    0,
    node.height
  ])
  const xs = [points[0], points[2], points[4], points[6]]
  const ys = [points[1], points[3], points[5], points[7]]
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

export function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null
  const x = Math.min(...rects.map((rect) => rect.x))
  const y = Math.min(...rects.map((rect) => rect.y))
  const right = Math.max(...rects.map((rect) => rect.x + rect.width))
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height))
  return { x, y, width: right - x, height: bottom - y }
}

export function matrixHasNonTranslation(matrix: Mat3): boolean {
  const epsilon = 1e-6
  return (
    Math.abs(matrix[0] - 1) > epsilon ||
    Math.abs(matrix[1]) > epsilon ||
    Math.abs(matrix[3]) > epsilon ||
    Math.abs(matrix[4] - 1) > epsilon
  )
}
