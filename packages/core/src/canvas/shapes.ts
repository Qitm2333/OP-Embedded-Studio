import type { Canvas, Path } from 'canvaskit-wasm'

import { polygonVertices } from '#core/geometry'
import type { SceneNode } from '#core/scene-graph'
import { vectorNetworkToPath, geometryBlobToPath } from '#core/vector'

import type { SkiaRenderer } from './renderer'

export function nodeHasRadius(node: SceneNode): boolean {
  return (
    node.cornerRadius > 0 ||
    (node.independentCorners &&
      (node.topLeftRadius > 0 ||
        node.topRightRadius > 0 ||
        node.bottomRightRadius > 0 ||
        node.bottomLeftRadius > 0))
  )
}

export function nodeHasSmoothCorners(node: SceneNode): boolean {
  return !node.independentCorners && node.cornerRadius > 0 && node.cornerSmoothing > 0
}

function clampCornerRadius(width: number, height: number, radius: number): number {
  return Math.max(0, Math.min(radius, width / 2, height / 2))
}

export function makeSmoothRRectPath(
  r: SkiaRenderer,
  node: SceneNode,
  spread = 0,
  offsetX = 0,
  offsetY = 0
): Path {
  const path = new r.ck.Path()
  const left = offsetX - spread
  const top = offsetY - spread
  const right = offsetX + node.width + spread
  const bottom = offsetY + node.height + spread
  const radius = clampCornerRadius(right - left, bottom - top, node.cornerRadius + spread)

  if (radius === 0) {
    path.addRect(r.ck.LTRBRect(left, top, right, bottom))
    return path
  }

  const smoothing = Math.max(0, Math.min(node.cornerSmoothing, 1))
  const exponent = 2 + smoothing * 3
  const samples = 12
  const addCorner = (cx: number, cy: number, startAngle: number, endAngle: number) => {
    for (let i = 1; i <= samples; i++) {
      const t = i / samples
      const angle = startAngle + (endAngle - startAngle) * t
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      const x = cx + Math.sign(cos) * radius * Math.abs(cos) ** (2 / exponent)
      const y = cy + Math.sign(sin) * radius * Math.abs(sin) ** (2 / exponent)
      path.lineTo(x, y)
    }
  }

  path.moveTo(left + radius, top)
  path.lineTo(right - radius, top)
  addCorner(right - radius, top + radius, -Math.PI / 2, 0)
  path.lineTo(right, bottom - radius)
  addCorner(right - radius, bottom - radius, 0, Math.PI / 2)
  path.lineTo(left + radius, bottom)
  addCorner(left + radius, bottom - radius, Math.PI / 2, Math.PI)
  path.lineTo(left, top + radius)
  addCorner(left + radius, top + radius, Math.PI, (Math.PI * 3) / 2)
  path.close()
  return path
}

export function makeNodeShapePath(
  r: SkiaRenderer,
  node: SceneNode,
  rect: Float32Array,
  hasRadius: boolean
): Path {
  const path = new r.ck.Path()
  switch (node.type) {
    case 'ELLIPSE':
      path.addOval(rect)
      break
    case 'VECTOR': {
      const vps = r.getVectorPaths(node)
      if (vps) {
        for (const vp of vps) path.addPath(vp)
      }
      break
    }
    case 'POLYGON':
    case 'STAR': {
      const polyPath = r.makePolygonPath(node)
      path.addPath(polyPath)
      polyPath.delete()
      break
    }
    default:
      if (nodeHasSmoothCorners(node)) {
        const smoothPath = makeSmoothRRectPath(r, node)
        path.addPath(smoothPath)
        smoothPath.delete()
      } else if (hasRadius) {
        path.addRRect(r.makeRRect(node))
      } else {
        path.addRect(rect)
      }
  }
  return path
}

export function makePolygonPath(r: SkiaRenderer, node: SceneNode): Path {
  const path = new r.ck.Path()
  polygonVertices(node).forEach((point, index) => {
    if (index === 0) path.moveTo(point.x, point.y)
    else path.lineTo(point.x, point.y)
  })
  path.close()
  return path
}

export function makeRRect(r: SkiaRenderer, node: SceneNode): Float32Array {
  if (node.independentCorners) {
    return new Float32Array([
      0,
      0,
      node.width,
      node.height,
      node.topLeftRadius,
      node.topLeftRadius,
      node.topRightRadius,
      node.topRightRadius,
      node.bottomRightRadius,
      node.bottomRightRadius,
      node.bottomLeftRadius,
      node.bottomLeftRadius
    ])
  }
  return r.ck.RRectXY(
    r.ck.LTRBRect(0, 0, node.width, node.height),
    node.cornerRadius,
    node.cornerRadius
  )
}

export function makeRRectWithSpread(
  r: SkiaRenderer,
  node: SceneNode,
  spread: number
): Float32Array {
  if (node.independentCorners) {
    return new Float32Array([
      -spread,
      -spread,
      node.width + spread,
      node.height + spread,
      Math.max(0, node.topLeftRadius + spread),
      Math.max(0, node.topLeftRadius + spread),
      Math.max(0, node.topRightRadius + spread),
      Math.max(0, node.topRightRadius + spread),
      Math.max(0, node.bottomRightRadius + spread),
      Math.max(0, node.bottomRightRadius + spread),
      Math.max(0, node.bottomLeftRadius + spread),
      Math.max(0, node.bottomLeftRadius + spread)
    ])
  }
  return r.ck.RRectXY(
    r.ck.LTRBRect(-spread, -spread, node.width + spread, node.height + spread),
    Math.max(0, node.cornerRadius + spread),
    Math.max(0, node.cornerRadius + spread)
  )
}

export function makeRRectWithOffset(
  r: SkiaRenderer,
  node: SceneNode,
  ox: number,
  oy: number,
  spread: number
): Float32Array {
  const s = spread
  if (node.independentCorners) {
    return new Float32Array([
      ox + s,
      oy + s,
      node.width + ox - s,
      node.height + oy - s,
      Math.max(0, node.topLeftRadius - s),
      Math.max(0, node.topLeftRadius - s),
      Math.max(0, node.topRightRadius - s),
      Math.max(0, node.topRightRadius - s),
      Math.max(0, node.bottomRightRadius - s),
      Math.max(0, node.bottomRightRadius - s),
      Math.max(0, node.bottomLeftRadius - s),
      Math.max(0, node.bottomLeftRadius - s)
    ])
  }
  return r.ck.RRectXY(
    r.ck.LTRBRect(ox + s, oy + s, node.width + ox - s, node.height + oy - s),
    Math.max(0, node.cornerRadius - s),
    Math.max(0, node.cornerRadius - s)
  )
}

export function clipNodeShape(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rect: Float32Array,
  hasRadius: boolean
): void {
  if (node.type === 'ELLIPSE') {
    const clipPath = new r.ck.Path()
    clipPath.addOval(rect)
    canvas.clipPath(clipPath, r.ck.ClipOp.Intersect, true)
    clipPath.delete()
  } else if (nodeHasSmoothCorners(node)) {
    const clipPath = makeSmoothRRectPath(r, node)
    canvas.clipPath(clipPath, r.ck.ClipOp.Intersect, true)
    clipPath.delete()
  } else if (hasRadius) {
    canvas.clipRRect(r.makeRRect(node), r.ck.ClipOp.Intersect, true)
  } else {
    canvas.clipRect(rect, r.ck.ClipOp.Intersect, true)
  }
}

export function getVectorPaths(r: SkiaRenderer, node: SceneNode): Path[] | null {
  if (!node.vectorNetwork) return null
  const cached = r.vectorPathCache.get(node.id)
  if (cached) return cached
  const paths = vectorNetworkToPath(r.ck, node.vectorNetwork)
  r.vectorPathCache.set(node.id, paths)
  return paths
}

export function getFillGeometry(r: SkiaRenderer, node: SceneNode): Path[] | null {
  if (node.fillGeometry.length === 0) return null
  const cached = r.fillGeometryCache.get(node.id)
  if (cached) return cached
  const paths = node.fillGeometry.map((g) =>
    geometryBlobToPath(r.ck, g.commandsBlob, g.windingRule)
  )
  r.fillGeometryCache.set(node.id, paths)
  return paths
}

export function getStrokeGeometry(r: SkiaRenderer, node: SceneNode): Path[] | null {
  if (node.strokeGeometry.length === 0) return null
  const cached = r.strokeGeometryCache.get(node.id)
  if (cached) return cached
  const paths = node.strokeGeometry.map((g) =>
    geometryBlobToPath(r.ck, g.commandsBlob, g.windingRule)
  )
  r.strokeGeometryCache.set(node.id, paths)
  return paths
}
