import { buildClonesMap } from '#core/kiwi/instance-overrides/sync'
import type { OverrideContext } from '#core/kiwi/instance-overrides/types'
import type { SceneNode } from '#core/scene-graph'
import { copyGeometryPaths } from '#core/scene-graph/copy'

export function propagateDsdChanges(
  ctx: OverrideContext,
  modified: Set<string>,
  sizeSet: Set<string>
): void {
  if (modified.size === 0) return

  const clonesOf = buildClonesMap(ctx.graph, ctx.activeNodeIds)
  const queue = [...modified]
  const visited = new Set<string>()

  let index = 0
  while (index < queue.length) {
    const sourceId = queue[index]
    index++
    const source = ctx.graph.getNode(sourceId)
    if (!source) continue
    const clones = clonesOf.get(sourceId)
    if (!clones) continue
    for (const cloneId of clones) {
      if (visited.has(cloneId)) continue
      visited.add(cloneId)
      const clone = ctx.graph.getNode(cloneId)
      if (!clone) continue
      if (!sizeSet.has(cloneId)) {
        const cu: Partial<SceneNode> = {}
        if (source.width !== clone.width) cu.width = source.width
        if (source.height !== clone.height) cu.height = source.height
        if (source.x !== clone.x) cu.x = source.x
        if (source.y !== clone.y) cu.y = source.y
        if (!ctx.geometryOverrideNodes.has(cloneId)) {
          if (source.fillGeometry !== clone.fillGeometry) cu.fillGeometry = copyGeometryPaths(source.fillGeometry)
          if (source.strokeGeometry !== clone.strokeGeometry) cu.strokeGeometry = copyGeometryPaths(source.strokeGeometry)
        }
        if (Object.keys(cu).length > 0) ctx.graph.updateNode(cloneId, cu)
      }
      queue.push(cloneId)
    }
  }
}
