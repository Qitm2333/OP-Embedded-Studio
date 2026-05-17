import { applyOverridePatch, type OverridePatch } from '#core/kiwi/instance-overrides/patches'
import { resolveOverrideTarget } from '#core/kiwi/instance-overrides/resolve'
import type { OverrideContext, SymbolOverride } from '#core/kiwi/instance-overrides/types'
import { guidToString } from '#core/kiwi/node-change/convert'
import { applyStyleRefsToFields } from '#core/kiwi/node-change/style-refs'

import { convertOverrideToProps } from './props'

function isActiveInstance(ctx: OverrideContext, nodeId: string | undefined): nodeId is string {
  return nodeId !== undefined && (!ctx.activeNodeIds || ctx.activeNodeIds.has(nodeId))
}

function patchFromSymbolOverride(
  ctx: OverrideContext,
  targetId: string,
  ov: SymbolOverride
): OverridePatch | null {
  const patch: OverridePatch = { targetId, source: 'symbol-override' }
  if (ov.overriddenSymbolID) {
    const swapGuid = guidToString(ov.overriddenSymbolID)
    patch.swapComponentId = ctx.guidToNodeId.get(swapGuid)
  }

  const { guidPath: _, overriddenSymbolID: _s, componentPropAssignments: _c, ...fields } = ov
  if (Object.keys(fields).length > 0) {
    applyStyleRefsToFields(ctx.changeMap, fields)
    const props = convertOverrideToProps(fields as Record<string, unknown>)
    if (Object.keys(props).length > 0) patch.props = props
  }

  return patch.swapComponentId || patch.props ? patch : null
}

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
    if (!isActiveInstance(ctx, nodeId)) continue

    for (const ov of overrides) {
      const guids = ov.guidPath?.guids
      if (!guids?.length) continue

      const targetId = resolveOverrideTarget(ctx, nodeId, guids)
      if (!targetId) continue

      if (targetId === nodeId && ctx.kiwiPropertyNodes.has(nodeId)) continue

      const patch = patchFromSymbolOverride(ctx, targetId, ov)
      if (!patch) continue
      overriddenNodes.add(targetId)
      applyOverridePatch(ctx, patch)
    }
  }
  return overriddenNodes
}
