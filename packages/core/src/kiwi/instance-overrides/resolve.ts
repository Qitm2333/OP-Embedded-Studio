import { guidToString } from '../convert'

import type { SceneNode } from '../../scene-graph'
import type { GUID } from '../codec'
import type { OverrideContext } from './types'

const MAX_CHAIN_DEPTH = 20

/**
 * Pre-compute componentId root for every node.
 *
 * Must run while all internal-page nodes are still alive. After overrides,
 * instance swaps delete intermediate clones, breaking the chain.
 * DSD resolution uses this to match across clone levels.
 */
export function preComputeRoots(ctx: OverrideContext): void {
  function resolve(nodeId: string, depth = 0): string {
    const cached = ctx.preComputedRoot.get(nodeId)
    if (cached !== undefined) return cached
    if (depth > MAX_CHAIN_DEPTH) return nodeId

    const node = ctx.graph.getNode(nodeId)
    if (node?.componentId && node.componentId !== nodeId) {
      const root = resolve(node.componentId, depth + 1)
      ctx.preComputedRoot.set(nodeId, root)
      return root
    }
    ctx.preComputedRoot.set(nodeId, nodeId)
    return nodeId
  }

  for (const node of ctx.graph.getAllNodes()) {
    if (node.componentId) resolve(node.id)
  }
}

/**
 * Walk the componentId chain to the ultimate source COMPONENT.
 * Falls back to kiwi symbolData for deleted internal-page nodes.
 */
export function getComponentRoot(ctx: OverrideContext, nodeId: string, depth = 0): string {
  const cached = ctx.componentIdRoot.get(nodeId)
  if (cached !== undefined) return cached
  if (depth > MAX_CHAIN_DEPTH) {
    ctx.componentIdRoot.set(nodeId, nodeId)
    return nodeId
  }

  const node = ctx.graph.getNode(nodeId)
  if (node?.componentId) {
    const root = getComponentRoot(ctx, node.componentId, depth + 1)
    ctx.componentIdRoot.set(nodeId, root)
    return root
  }

  // For deleted nodes (internal page), resolve via kiwi symbolData
  const figmaId = ctx.nodeIdToGuid.get(nodeId)
  if (figmaId) {
    const nc = ctx.changeMap.get(figmaId)
    const symId = nc?.symbolData?.symbolID
    if (symId) {
      const compNodeId = ctx.guidToNodeId.get(guidToString(symId))
      if (compNodeId && compNodeId !== nodeId) {
        const root = getComponentRoot(ctx, compNodeId, depth + 1)
        ctx.componentIdRoot.set(nodeId, root)
        return root
      }
    }
  }

  ctx.componentIdRoot.set(nodeId, nodeId)
  return nodeId
}

/**
 * Find a descendant whose componentId matches, walking recursively.
 *
 * Pass 1: exact componentId on direct children.
 * Pass 2: root match — only if exactly one child shares the root (avoids
 *         ambiguity when multiple siblings share the same root).
 * Pass 3: recurse into children.
 */
export function findNodeByComponentId(
  ctx: OverrideContext,
  parentId: string,
  componentId: string
): string | null {
  const parent = ctx.graph.getNode(parentId)
  if (!parent) return null

  for (const childId of parent.childIds) {
    const child = ctx.graph.getNode(childId)
    if (child?.componentId === componentId) return childId
  }

  const targetRoot = ctx.preComputedRoot.get(componentId) ?? getComponentRoot(ctx, componentId)
  if (targetRoot) {
    let rootMatch: string | null = null
    let ambiguous = false
    for (const childId of parent.childIds) {
      const child = ctx.graph.getNode(childId)
      if (!child?.componentId) continue
      const childRoot =
        ctx.preComputedRoot.get(child.componentId) ?? getComponentRoot(ctx, child.componentId)
      if (childRoot === targetRoot) {
        if (rootMatch) {
          ambiguous = true
          break
        }
        rootMatch = childId
      }
    }
    if (rootMatch && !ambiguous) return rootMatch
  }

  for (const childId of parent.childIds) {
    const deep = findNodeByComponentId(ctx, childId, componentId)
    if (deep) return deep
  }
  return null
}

/**
 * Resolve a guidPath to a target node within an instance subtree.
 *
 * Each GUID in the path identifies an overrideKey → figmaGuid → graph node.
 * The chain walks from the instance down to the target.
 */
export function resolveOverrideTarget(
  ctx: OverrideContext,
  instanceId: string,
  guids: GUID[]
): string | null {
  let currentId = instanceId
  for (const guid of guids) {
    const key = guidToString(guid)
    const figmaGuid = ctx.overrideKeyToGuid.get(key) ?? key
    const remapped = ctx.guidToNodeId.get(figmaGuid)
    if (!remapped) return null

    const current = ctx.graph.getNode(currentId)
    if (current?.componentId === remapped) continue

    const found = findNodeByComponentId(ctx, currentId, remapped)
    if (found) {
      currentId = found
      continue
    }

    // After an instance swap, the child's componentId points to the new
    // component, not the one referenced by the guidPath. Fall back to the
    // single child of a swapped instance — it occupies the same slot.
    const parent = ctx.graph.getNode(currentId)
    if (parent?.childIds.length === 1) {
      currentId = parent.childIds[0]
      continue
    }

    return null
  }
  return currentId
}

/**
 * Repopulate an INSTANCE node with children from a new component (instance swap).
 * Only renames when the current name matches the root component name (preserves
 * user-given names). Clears the componentIdRoot cache after changing the tree.
 */
export function repopulateInstance(ctx: OverrideContext, nodeId: string, compId: string): void {
  const node = ctx.graph.getNode(nodeId)
  if (node?.type !== 'INSTANCE') return

  const rootCompId = node.componentId ? getComponentRoot(ctx, node.componentId) : undefined
  const rootComp = rootCompId ? ctx.graph.getNode(rootCompId) : undefined
  for (const childId of Array.from(node.childIds)) ctx.graph.deleteNode(childId)
  const comp = ctx.graph.getNode(compId)
  const updates: Partial<SceneNode> = { componentId: compId }
  if (comp?.name && rootComp?.name && node.name === rootComp.name) {
    updates.name = comp.name
  }
  ctx.graph.updateNode(nodeId, updates)
  if (comp && comp.childIds.length > 0) {
    ctx.graph.populateInstanceChildren(nodeId, compId)
  }
  ctx.componentIdRoot.clear()
}
