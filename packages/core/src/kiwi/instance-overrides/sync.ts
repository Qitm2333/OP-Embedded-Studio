import type { ProtectionMap, ProtectedField } from '#core/kiwi/instance-overrides/patches'
import { isFieldProtected } from '#core/kiwi/instance-overrides/patches'
import type { SceneGraph, SceneNode } from '#core/scene-graph'
import { copyFills, copyStrokes, copyEffects, copyStyleRuns } from '#core/scene-graph/copy'

/**
 * Copy appearance props from source to target (text, visibility, fills, etc.).
 * Only writes properties that actually differ.
 */
function canSync(
  protections: ProtectionMap | undefined,
  targetId: string,
  field: ProtectedField
): boolean {
  return !isFieldProtected(protections, targetId, field)
}

type SyncFn = (
  source: SceneNode,
  target: SceneNode,
  updates: Partial<SceneNode>,
  protections?: ProtectionMap
) => void

type DirectSyncKey = 'text' | 'visible' | 'opacity' | 'locked' | 'layoutGrow' | 'textAutoResize'
type CopiedSyncKey = 'fills' | 'strokes' | 'effects' | 'styleRuns'

function assignDirectUpdate(
  key: DirectSyncKey,
  source: SceneNode,
  updates: Partial<SceneNode>
): void {
  switch (key) {
    case 'text':
      updates.text = source.text
      break
    case 'visible':
      updates.visible = source.visible
      break
    case 'opacity':
      updates.opacity = source.opacity
      break
    case 'locked':
      updates.locked = source.locked
      break
    case 'layoutGrow':
      updates.layoutGrow = source.layoutGrow
      break
    case 'textAutoResize':
      updates.textAutoResize = source.textAutoResize
      break
  }
}

function directSync(key: DirectSyncKey, field: ProtectedField): SyncFn {
  return (source, target, updates, protections) => {
    if (source[key] !== target[key] && canSync(protections, target.id, field)) {
      assignDirectUpdate(key, source, updates)
    }
  }
}

const DIRECT_SYNCERS: SyncFn[] = [
  directSync('text', 'text'),
  directSync('visible', 'visible'),
  directSync('opacity', 'opacity'),
  directSync('locked', 'locked'),
  directSync('layoutGrow', 'layoutGrow'),
  directSync('textAutoResize', 'textAutoResize')
]

function syncDirectFields(
  source: SceneNode,
  target: SceneNode,
  updates: Partial<SceneNode>,
  protections?: ProtectionMap
): void {
  for (const sync of DIRECT_SYNCERS) sync(source, target, updates, protections)
}

function assignCopiedUpdate(
  key: CopiedSyncKey,
  source: SceneNode,
  updates: Partial<SceneNode>
): void {
  switch (key) {
    case 'fills':
      updates.fills = copyFills(source.fills)
      break
    case 'strokes':
      updates.strokes = copyStrokes(source.strokes)
      break
    case 'effects':
      updates.effects = copyEffects(source.effects)
      break
    case 'styleRuns':
      updates.styleRuns = copyStyleRuns(source.styleRuns)
      break
  }
}

function copiedSync(key: CopiedSyncKey, field: ProtectedField): SyncFn {
  return (source, target, updates, protections) => {
    if (source[key] !== target[key] && canSync(protections, target.id, field)) {
      assignCopiedUpdate(key, source, updates)
    }
  }
}

const COPIED_SYNCERS: SyncFn[] = [
  copiedSync('fills', 'fills'),
  copiedSync('strokes', 'strokes'),
  copiedSync('effects', 'effects'),
  copiedSync('styleRuns', 'styleRuns')
]

function syncCopiedFields(
  source: SceneNode,
  target: SceneNode,
  updates: Partial<SceneNode>,
  protections?: ProtectionMap
): void {
  for (const sync of COPIED_SYNCERS) sync(source, target, updates, protections)
}

export function syncNodeProps(
  graph: SceneGraph,
  source: SceneNode,
  target: SceneNode,
  protections?: ProtectionMap
): void {
  const updates: Partial<SceneNode> = {}
  syncDirectFields(source, target, updates, protections)
  syncCopiedFields(source, target, updates, protections)
  if (Object.keys(updates).length > 0) graph.updateNode(target.id, updates)
}

/**
 * Re-clone an instance's children from a new source (after instance swap).
 * Marks the target in `swappedInstances` so transitive sync propagates the swap.
 */
export function recloneChildren(
  graph: SceneGraph,
  srcChildId: string,
  tgtNode: SceneNode,
  swappedInstances: Set<string>,
  protections?: ProtectionMap
): void {
  const srcChild = graph.getNode(srcChildId)
  if (!srcChild) return

  for (const childId of Array.from(tgtNode.childIds)) graph.deleteNode(childId)
  graph.updateNode(tgtNode.id, { name: srcChild.name, componentId: srcChild.componentId })
  syncNodeProps(graph, srcChild, tgtNode, protections)
  if (srcChild.childIds.length > 0) {
    graph.populateInstanceChildren(tgtNode.id, srcChildId)
  }
  swappedInstances.add(tgtNode.id)
}

/**
 * Recursively sync children between source and target trees.
 * Handles instance swap propagation via `swappedInstances`.
 */
export function syncChildrenDeep(
  graph: SceneGraph,
  sourceId: string,
  targetId: string,
  swappedInstances: Set<string>,
  skip?: Set<string>,
  protections?: ProtectionMap
): void {
  const src = graph.getNode(sourceId)
  const tgt = graph.getNode(targetId)
  if (!src || !tgt) return
  const len = Math.min(src.childIds.length, tgt.childIds.length)
  for (let i = 0; i < len; i++) {
    if (skip?.has(tgt.childIds[i])) continue
    const srcNode = graph.getNode(src.childIds[i])
    const tgtNode = graph.getNode(tgt.childIds[i])
    if (!srcNode || !tgtNode || srcNode.type !== tgtNode.type) continue

    if (
      srcNode.type === 'INSTANCE' &&
      swappedInstances.has(src.childIds[i]) &&
      srcNode.componentId !== tgtNode.componentId
    ) {
      recloneChildren(graph, src.childIds[i], tgtNode, swappedInstances, protections)
      continue
    }

    syncNodeProps(graph, srcNode, tgtNode, protections)
    syncChildrenDeep(graph, src.childIds[i], tgt.childIds[i], swappedInstances, skip, protections)
  }
}

/** Build a map of componentId → list of clone node IDs. */
export function buildClonesMap(
  graph: SceneGraph,
  activeNodeIds?: Set<string>
): Map<string, string[]> {
  const clonesOf = new Map<string, string[]>()
  for (const node of graph.getAllNodes()) {
    if (activeNodeIds && !activeNodeIds.has(node.id)) continue
    if (!node.componentId) continue
    let arr = clonesOf.get(node.componentId)
    if (!arr) {
      arr = []
      clonesOf.set(node.componentId, arr)
    }
    arr.push(node.id)
  }
  return clonesOf
}

/** Expand seeds to include INSTANCE/COMPONENT parents up the tree. */
function expandSeedsToParents(graph: SceneGraph, seeds: Set<string>): Set<string> {
  const expanded = new Set(seeds)
  for (const seedId of seeds) {
    let cur = graph.getNode(seedId)
    while (cur?.parentId) {
      const parent = graph.getNode(cur.parentId)
      if (!parent) break
      if (parent.type === 'INSTANCE' || parent.type === 'COMPONENT') {
        expanded.add(parent.id)
      }
      cur = parent
    }
  }
  return expanded
}

/** BFS from expanded seeds through clone chains to find all nodes needing sync. */
function buildNeedsSyncSet(
  expandedSeeds: Set<string>,
  clonesOf: Map<string, string[]>
): Set<string> {
  const needsSync = new Set<string>()
  const queue = [...expandedSeeds]
  for (let id = queue.pop(); id !== undefined; id = queue.pop()) {
    const clones = clonesOf.get(id)
    if (!clones) continue
    for (const cloneId of clones) {
      if (needsSync.has(cloneId)) continue
      needsSync.add(cloneId)
      queue.push(cloneId)
    }
  }
  return needsSync
}

/**
 * Propagate overrides transitively through clone chains.
 *
 * Nodes in `seeds` are override sources — their clones are synced but
 * the seeds themselves are NOT overwritten (they carry explicit overrides).
 */
export function propagateOverridesTransitively(
  graph: SceneGraph,
  seeds: Set<string>,
  swappedInstances: Set<string>,
  componentIdRoot: Map<string, string>,
  protect?: Set<string>,
  activeNodeIds?: Set<string>,
  protections?: ProtectionMap
): void {
  if (seeds.size === 0) return

  componentIdRoot.clear()
  const clonesOf = buildClonesMap(graph, activeNodeIds)
  const expandedSeeds = expandSeedsToParents(graph, seeds)
  const needsSync = buildNeedsSyncSet(expandedSeeds, clonesOf)

  // Merge seeds + protect into a single skip set for syncChildrenDeep
  const skip = protect && protect.size > 0 ? new Set([...seeds, ...protect]) : seeds

  const visited = new Set<string>()
  const syncQueue = [...expandedSeeds]
  let index = 0
  while (index < syncQueue.length) {
    const sourceId = syncQueue[index]
    index++
    const clones = clonesOf.get(sourceId)
    if (!clones) continue
    const source = graph.getNode(sourceId)
    if (!source) continue

    for (const cloneId of clones) {
      if (!needsSync.has(cloneId) || visited.has(cloneId)) continue
      visited.add(cloneId)
      const node = graph.getNode(cloneId)
      if (!node) continue

      if (skip.has(cloneId)) {
        syncQueue.push(cloneId)
        continue
      }

      syncNodeProps(graph, source, node, protections)
      if (source.childIds.length !== node.childIds.length) {
        for (const childId of Array.from(node.childIds)) graph.deleteNode(childId)
        if (source.childIds.length > 0) {
          graph.populateInstanceChildren(node.id, sourceId)
        }
      } else if (source.childIds.length > 0 && node.childIds.length > 0) {
        syncChildrenDeep(graph, sourceId, node.id, swappedInstances, skip, protections)
      }
      syncQueue.push(cloneId)
    }
  }
}
