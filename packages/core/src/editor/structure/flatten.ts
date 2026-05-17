import { canMakeBooleanSourcePath } from '#core/canvas/boolean'
import { flattenNodesToVectorProps } from '#core/canvas/flatten'
import { restoreSubtree, snapshotSubtree } from '#core/editor/clipboard/subtree-history'
import type { EditorContext } from '#core/editor/types'
import type { SceneNode } from '#core/scene-graph'

import { selectedNodesInSharedParent } from './selection'

export function flattenSelected(ctx: EditorContext, selectedNodes: SceneNode[]) {
  const renderer = ctx.getRenderer()
  if (!renderer) return null

  const selection = selectedNodesInSharedParent(ctx, selectedNodes)
  if (!selection) return null
  const { topLevel, parentId, parent } = selection
  if (topLevel.some((node) => !canMakeBooleanSourcePath(node))) return null

  const childIds = topLevel.map((node) => node.id)
  const childSnapshots = childIds.map((id) => ({ id, subtree: snapshotSubtree(ctx.graph, id) }))
  const prevSelection = new Set(ctx.state.selectedIds)
  const firstIndex = Math.min(...childIds.map((id) => parent.childIds.indexOf(id)))
  const vectorProps = flattenNodesToVectorProps(renderer, ctx.graph, topLevel)
  if (!vectorProps) return null

  const vector = ctx.graph.createNode('VECTOR', parentId, { ...vectorProps, strokes: [] })
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
