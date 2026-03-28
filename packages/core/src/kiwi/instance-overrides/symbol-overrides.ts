import { guidToString } from '../convert'
import { convertOverrideToProps } from '../convert-overrides'
import { resolveOverrideTarget, repopulateInstance } from './resolve'

import type { OverrideContext } from './types'

/**
 * Apply symbolOverrides from kiwi data.
 *
 * Handles instance swaps (overriddenSymbolID) and property overrides
 * (fills, text, visibility, etc.). Returns the set of directly
 * overridden node IDs (used as seeds for transitive sync).
 */
export function applySymbolOverrides(ctx: OverrideContext): Set<string> {
  const overriddenNodes = new Set<string>()
  ctx.componentIdRoot.clear()

  for (const [ncId, nc] of ctx.changeMap) {
    if (nc.type !== 'INSTANCE') continue
    const overrides = nc.symbolData?.symbolOverrides
    if (!overrides?.length) continue

    const nodeId = ctx.guidToNodeId.get(ncId)
    if (!nodeId) continue

    for (const ov of overrides) {
      const guids = ov.guidPath?.guids
      if (!guids?.length) continue

      const targetId = resolveOverrideTarget(ctx, nodeId, guids)
      if (!targetId) continue

      // When a symbolOverride resolves to the instance itself (self-reference
      // to the component shell), skip it if the instance has explicit kiwi NC
      // properties — the instance's own values take precedence.
      if (targetId === nodeId && ctx.kiwiPropertyNodes.has(nodeId)) continue

      overriddenNodes.add(targetId)

      if (ov.overriddenSymbolID) {
        const swapGuid = guidToString(ov.overriddenSymbolID)
        const newCompId = ctx.guidToNodeId.get(swapGuid)
        if (newCompId) {
          repopulateInstance(ctx, targetId, newCompId)
          ctx.swappedInstances.add(targetId)
        }
      }

      const { guidPath: _, overriddenSymbolID: _s, componentPropAssignments: _c, ...fields } = ov
      if (Object.keys(fields).length === 0) continue

      const updates = convertOverrideToProps(fields as Record<string, unknown>)
      if (Object.keys(updates).length > 0) {
        ctx.graph.updateNode(targetId, updates)
      }
    }
  }
  return overriddenNodes
}
