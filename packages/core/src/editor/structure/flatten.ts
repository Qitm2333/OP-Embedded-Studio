import { makeBooleanSourcePath, nodePathTransform } from '#core/canvas/boolean'
import { restoreSubtree, snapshotSubtree } from '#core/editor/clipboard/subtree-history'
import type { EditorContext } from '#core/editor/types'
import { parseSVGPath } from '#core/io/formats/svg/parse-path'
import type { SceneNode } from '#core/scene-graph'
import { copyFills } from '#core/scene-graph/copy'

import { selectedNodesInSharedParent } from './selection'

export function flattenSelected(ctx: EditorContext, selectedNodes: SceneNode[]) {
  const renderer = ctx.getRenderer()
  if (!renderer) return null

  const selection = selectedNodesInSharedParent(ctx, selectedNodes)
  if (!selection) return null
  const { topLevel, parentId, parent } = selection

  const childIds = topLevel.map((node) => node.id)
  const childSnapshots = childIds.map((id) => ({ id, subtree: snapshotSubtree(ctx.graph, id) }))
  const prevSelection = new Set(ctx.state.selectedIds)
  const firstIndex = Math.min(...childIds.map((id) => parent.childIds.indexOf(id)))
  const path = new renderer.ck.Path()

  for (const node of topLevel) {
    const childPath = makeBooleanSourcePath(renderer, node, ctx.graph)
    if (!childPath) continue
    childPath.transform(nodePathTransform(renderer, node))
    path.addPath(childPath)
    childPath.delete()
  }

  const bounds = path.getBounds()
  if (bounds[2] <= bounds[0] || bounds[3] <= bounds[1]) {
    path.delete()
    return null
  }

  path.transform(renderer.ck.Matrix.translated(-bounds[0], -bounds[1]))
  const svgPath = path.toSVGString()
  path.delete()

  const first = topLevel[0]
  const vector = ctx.graph.createNode('VECTOR', parentId, {
    name: 'Flatten',
    x: bounds[0],
    y: bounds[1],
    width: bounds[2] - bounds[0],
    height: bounds[3] - bounds[1],
    fills: copyFills(first.fills),
    strokes: [],
    vectorNetwork: parseSVGPath(svgPath)
  })
  const vectorSnapshot = structuredClone(vector)
  ctx.graph.insertChildAt(vector.id, parentId, firstIndex)
  for (const id of childIds) ctx.graph.deleteNode(id)
  ctx.setSelectedIds(new Set([vector.id]))

  ctx.undo.push({
    label: 'Flatten',
    forward: () => {
      const restored = ctx.graph.createNode('VECTOR', parentId, vectorSnapshot)
      ctx.graph.insertChildAt(restored.id, parentId, firstIndex)
      for (const id of childIds) ctx.graph.deleteNode(id)
      ctx.setSelectedIds(new Set([restored.id]))
    },
    inverse: () => {
      ctx.graph.deleteNode(vector.id)
      for (let i = 0; i < childSnapshots.length; i++) {
        const { id, subtree } = childSnapshots[i]
        const root = subtree.get(id)
        if (!root) continue
        restoreSubtree(ctx.graph, root, parentId, subtree)
        ctx.graph.insertChildAt(id, parentId, firstIndex + i)
      }
      ctx.setSelectedIds(prevSelection)
    }
  })

  return vector.id
}
