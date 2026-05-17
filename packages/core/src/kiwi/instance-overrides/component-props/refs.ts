import { guidToString } from '#core/kiwi/node-change/convert'

import type { ComponentPropRef, ComponentPropValue, OverrideContext } from '#core/kiwi/instance-overrides/types'

import { normalizePropName, stringToGuidParts } from './values'

export function findPropRefs(
  ctx: OverrideContext,
  nodeId: string,
  propRefsMap: Map<string, ComponentPropRef[]>
): ComponentPropRef[] | undefined {
  let sourceId: string | undefined = nodeId
  for (let depth = 0; sourceId && depth < 10; depth++) {
    const figmaId = ctx.nodeIdToGuid.get(sourceId)
    if (figmaId) {
      const refs = propRefsMap.get(figmaId)
      if (refs) return refs
    }
    const node = ctx.graph.getNode(sourceId)
    const nextId = node?.componentId ?? undefined
    if (nextId === sourceId) break
    sourceId = nextId
  }
  return undefined
}

export function fallbackRefsForChild(
  ctx: OverrideContext,
  childName: string,
  valueByDef: Map<string, ComponentPropValue>
): ComponentPropRef[] | undefined {
  const normalizedChildName = normalizePropName(childName)
  const refs: ComponentPropRef[] = []
  for (const defId of valueByDef.keys()) {
    const propName = ctx.propNames.get(defId)
    if (propName && normalizePropName(propName) === normalizedChildName) {
      refs.push({ defID: stringToGuidParts(defId), componentPropNodeField: 'VISIBLE' })
    }
  }
  return refs.length > 0 ? refs : undefined
}

export function valueForRef(
  ref: ComponentPropRef,
  valueByDef: Map<string, ComponentPropValue>
): ComponentPropValue | undefined {
  return ref.defID ? valueByDef.get(guidToString(ref.defID)) : undefined
}
