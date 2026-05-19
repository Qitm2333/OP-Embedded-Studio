import { populateAndApplyOverrides } from '#core/kiwi/instance-overrides'
import type { InstanceNodeChange } from '#core/kiwi/instance-overrides'
import type { SceneGraph } from '#core/scene-graph'

export interface LazyFigImportContext {
  changeMap: Map<string, InstanceNodeChange>
  guidToNodeId: Map<string, string>
  blobs: Uint8Array[]
  populatedRootIds: Set<string>
}

const lazyFigImportContexts = new WeakMap<SceneGraph, LazyFigImportContext>()

export function setLazyFigImportContext(graph: SceneGraph, context: LazyFigImportContext): void {
  lazyFigImportContexts.set(graph, context)
}

export function getLazyFigImportContext(graph: SceneGraph): LazyFigImportContext | undefined {
  return lazyFigImportContexts.get(graph)
}

export function populateLazyFigImportRoots(graph: SceneGraph, rootIds: Iterable<string>): boolean {
  const context = getLazyFigImportContext(graph)
  if (!context) return false

  const pending = [...rootIds].filter((id) => id && !context.populatedRootIds.has(id))
  if (pending.length === 0) return false

  populateAndApplyOverrides(
    graph,
    context.changeMap,
    context.guidToNodeId,
    context.blobs,
    pending
  )

  for (const id of pending) context.populatedRootIds.add(id)
  return true
}
