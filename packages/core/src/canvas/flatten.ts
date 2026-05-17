import { parseSVGPath } from '#core/io/formats/svg/parse-path'
import type { SceneGraph, SceneNode } from '#core/scene-graph'
import { copyFills } from '#core/scene-graph/copy'

import { makeBooleanSourcePath, nodePathTransform } from './boolean'
import type { SkiaRenderer } from './renderer'

export function flattenNodesToVectorProps(
  renderer: SkiaRenderer,
  graph: SceneGraph,
  nodes: SceneNode[]
): Pick<SceneNode, 'name' | 'x' | 'y' | 'width' | 'height' | 'fills' | 'vectorNetwork'> | null {
  const path = new renderer.ck.Path()
  for (const node of nodes) {
    const nodePath = makeBooleanSourcePath(renderer, node, graph)
    if (!nodePath) {
      path.delete()
      return null
    }
    nodePath.transform(nodePathTransform(renderer, node))
    path.addPath(nodePath)
    nodePath.delete()
  }

  const bounds = path.getBounds()
  if (bounds[2] <= bounds[0] || bounds[3] <= bounds[1]) {
    path.delete()
    return null
  }

  path.transform(renderer.ck.Matrix.translated(-bounds[0], -bounds[1]))
  const vectorNetwork = parseSVGPath(path.toSVGString())
  path.delete()

  return {
    name: 'Flatten',
    x: bounds[0],
    y: bounds[1],
    width: bounds[2] - bounds[0],
    height: bounds[3] - bounds[1],
    fills: copyFills(nodes[0].fills),
    vectorNetwork
  }
}
