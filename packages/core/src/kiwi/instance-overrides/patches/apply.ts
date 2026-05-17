import { repopulateInstance } from '#core/kiwi/instance-overrides/resolve'
import type { OverrideContext } from '#core/kiwi/instance-overrides/types'
import type { SceneNode } from '#core/scene-graph'

import { protectField, protectPatchProps } from './protection'
import type { OverridePatch } from './types'

function preserveStrokeShapeProps(target: SceneNode, updates: Partial<SceneNode>): void {
  if (!updates.strokes) return
  updates.strokes = updates.strokes.map((stroke, index) => {
    if (index >= target.strokes.length) {
      return {
        ...stroke,
        cap: target.strokeCap,
        join: target.strokeJoin,
        dashPattern: target.dashPattern
      }
    }
    const existing = target.strokes[index]
    return {
      ...stroke,
      cap: existing.cap,
      join: existing.join,
      dashPattern: existing.dashPattern
    }
  })
}

export function applyOverridePatch(ctx: OverrideContext, patch: OverridePatch): boolean {
  let changed = false
  if (patch.swapComponentId) {
    repopulateInstance(ctx, patch.targetId, patch.swapComponentId)
    protectField(ctx.protectedFields, patch.targetId, 'structure')
    changed = true
  }

  if (patch.props && Object.keys(patch.props).length > 0) {
    const target = ctx.graph.getNode(patch.targetId)
    if (target) {
      preserveStrokeShapeProps(target, patch.props)
      ctx.graph.updateNode(patch.targetId, patch.props)
      protectPatchProps(ctx.protectedFields, patch.targetId, patch.props)
      changed = true
    }
  }
  return changed
}
