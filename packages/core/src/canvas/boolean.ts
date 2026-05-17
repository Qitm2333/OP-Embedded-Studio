import type { Canvas, Path, PathOp } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode } from '#core/scene-graph'

import { makeArcPath } from './fills'
import type { SkiaRenderer } from './renderer'
import { nodeHasRadius } from './shapes'

const BOOLEAN_PATH_OP: Record<
  NonNullable<SceneNode['booleanOperation']>,
  'Union' | 'Difference' | 'Intersect' | 'XOR'
> = {
  UNION: 'Union',
  SUBTRACT: 'Difference',
  INTERSECT: 'Intersect',
  EXCLUDE: 'XOR'
}

export function nodePathTransform(r: SkiaRenderer, child: SceneNode): number[] {
  const transforms = [r.ck.Matrix.translated(child.x, child.y)]
  if (child.rotation !== 0) {
    transforms.push(
      r.ck.Matrix.rotated((child.rotation * Math.PI) / 180, child.width / 2, child.height / 2)
    )
  }
  if (child.flipX || child.flipY) {
    transforms.push(
      r.ck.Matrix.scaled(
        child.flipX ? -1 : 1,
        child.flipY ? -1 : 1,
        child.width / 2,
        child.height / 2
      )
    )
  }
  if (transforms.length === 1) return transforms[0]
  return r.ck.Matrix.multiply(...transforms)
}

function lineStrokePath(r: SkiaRenderer, node: SceneNode): Path | null {
  const path = new r.ck.Path()
  path.moveTo(0, 0)
  path.lineTo(node.width, node.height)
  const stroke = node.strokes.find((item) => item.visible)
  return path.stroke({ width: stroke?.weight ?? 1 })
}

export function makeBooleanSourcePath(
  r: SkiaRenderer,
  node: SceneNode,
  graph: SceneGraph
): Path | null {
  if (node.type === 'BOOLEAN_OPERATION') return makeBooleanOperationPath(r, node, graph)
  if (node.type === 'TEXT' || node.type === 'SECTION' || node.type === 'COMPONENT_SET') return null
  if (node.type === 'LINE') return lineStrokePath(r, node)
  if (node.type === 'ELLIPSE' && node.arcData) return makeArcPath(r, node)

  const rect = r.ck.LTRBRect(0, 0, node.width, node.height)
  return r.makeNodeShapePath(node, rect, nodeHasRadius(node))
}

function transformedShapePath(r: SkiaRenderer, child: SceneNode, graph: SceneGraph): Path | null {
  const path = makeBooleanSourcePath(r, child, graph)
  if (!path) return null
  path.transform(nodePathTransform(r, child))
  return path
}

function operationForNode(r: SkiaRenderer, node: SceneNode): PathOp {
  const operation = node.booleanOperation ?? 'UNION'
  return r.ck.PathOp[BOOLEAN_PATH_OP[operation]]
}

export function makeBooleanOperationPath(
  r: SkiaRenderer,
  node: SceneNode,
  graph: SceneGraph
): Path | null {
  const childPaths: Path[] = []
  for (const childId of node.childIds) {
    const child = graph.getNode(childId)
    if (!child || !child.visible) continue
    const path = transformedShapePath(r, child, graph)
    if (path) childPaths.push(path)
  }

  if (childPaths.length === 0) return null

  const first = childPaths[0]
  for (const path of childPaths.slice(1)) {
    first.op(path, operationForNode(r, node))
    path.delete()
  }
  return first
}

export function renderBooleanOperation(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph
): void {
  const path = makeBooleanOperationPath(r, node, graph)
  if (!path) return

  for (let fillIndex = 0; fillIndex < node.fills.length; fillIndex++) {
    const fill = node.fills[fillIndex]
    if (!fill.visible || !r.applyFill(fill, node, graph, fillIndex)) continue
    r.fillPaint.setAlphaf(fill.opacity)
    canvas.drawPath(path, r.fillPaint)
    r.fillPaint.setShader(null)
  }

  for (const stroke of node.strokes) {
    if (!stroke.visible) continue
    const color = r.resolveStrokeColor(stroke, 0, node, graph)
    r.strokePaint.setColor(r.ck.Color4f(color.r, color.g, color.b, color.a))
    r.strokePaint.setStrokeWidth(stroke.weight)
    r.strokePaint.setAlphaf(stroke.opacity)
    canvas.drawPath(path, r.strokePaint)
  }

  path.delete()
}
