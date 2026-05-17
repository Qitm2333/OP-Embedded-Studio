import type { OverridePatch } from '#core/kiwi/instance-overrides/patches'
import type { OverrideContext, SymbolOverride } from '#core/kiwi/instance-overrides/types'
import { guidToString } from '#core/kiwi/node-change/convert'
import { applyStyleRefsToFields } from '#core/kiwi/node-change/style-refs'

import { convertOverrideToProps } from './props'

export function patchFromSymbolOverride(
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
