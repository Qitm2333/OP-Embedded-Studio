import { applyOverridePatch } from '#core/kiwi/instance-overrides/patches'
import { guidToString } from '#core/kiwi/node-change/convert'

import { collectAssignmentsMap, collectPropRefsMap } from './component-props/maps'
import {
  assignmentsToValueMap,
  normalizePropName,
  propTextCharacters,
  stringToGuidParts
} from './component-props/values'
import { getComponentRoot, resolveOverrideTarget } from './resolve'
import type {
  OverrideContext,
  ComponentPropAssignment,
  ComponentPropRef,
  ComponentPropValue
} from './types'

/**
 * Walk the componentId chain to find componentPropRefs for a node.
 * The refs may be defined on the component several levels up.
 */
function findPropRefs(
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

/**
 * Recursively apply prop assignments to children of a parent node.
 * Handles VISIBLE toggles and OVERRIDDEN_SYMBOL_ID (instance swap).
 */
function fallbackRefsForChild(
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

function applyPatchAndMark(
  ctx: OverrideContext,
  childId: string,
  patch: Parameters<typeof applyOverridePatch>[1],
  modified?: Set<string>
): void {
  if (applyOverridePatch(ctx, patch)) modified?.add(childId)
}

function applyVisibleProp(
  ctx: OverrideContext,
  childId: string,
  val: ComponentPropValue,
  modified?: Set<string>
): void {
  if (val.boolValue === undefined) return
  applyPatchAndMark(
    ctx,
    childId,
    { targetId: childId, source: 'component-prop', props: { visible: val.boolValue } },
    modified
  )
}

function applyTextProp(
  ctx: OverrideContext,
  childId: string,
  val: ComponentPropValue,
  modified?: Set<string>
): void {
  const child = ctx.graph.getNode(childId)
  const text = propTextCharacters(val)
  if (text === undefined || child?.type !== 'TEXT') return
  applyPatchAndMark(
    ctx,
    childId,
    { targetId: childId, source: 'component-prop', props: { text } },
    modified
  )
}

function applySwapProp(
  ctx: OverrideContext,
  childId: string,
  val: ComponentPropValue,
  modified?: Set<string>
): void {
  const swapId = propTextCharacters(val) ?? (val.guidValue ? guidToString(val.guidValue) : undefined)
  const newCompId = swapId ? ctx.guidToNodeId.get(swapId) : undefined
  if (!newCompId) return
  applyPatchAndMark(
    ctx,
    childId,
    {
      targetId: childId,
      source: 'component-prop',
      swapComponentId: getComponentRoot(ctx, newCompId)
    },
    modified
  )
}

function applyComponentPropRef(
  ctx: OverrideContext,
  childId: string,
  ref: ComponentPropRef,
  val: ComponentPropValue,
  modified?: Set<string>
): void {
  switch (ref.componentPropNodeField) {
    case 'VISIBLE':
      applyVisibleProp(ctx, childId, val, modified)
      break
    case 'TEXT_DATA':
      applyTextProp(ctx, childId, val, modified)
      break
    case 'OVERRIDDEN_SYMBOL_ID':
      applySwapProp(ctx, childId, val, modified)
      break
  }
}

function applyChildPropRefs(
  ctx: OverrideContext,
  childId: string,
  refs: ComponentPropRef[] | undefined,
  valueByDef: Map<string, ComponentPropValue>,
  modified?: Set<string>
): void {
  if (!refs) return
  for (const ref of refs) {
    if (!ref.defID) continue
    const val = valueByDef.get(guidToString(ref.defID))
    if (val) applyComponentPropRef(ctx, childId, ref, val, modified)
  }
}

function applyPropAssignments(
  ctx: OverrideContext,
  parentId: string,
  valueByDef: Map<string, ComponentPropValue>,
  propRefsMap: Map<string, ComponentPropRef[]>,
  modified?: Set<string>
): void {
  const parent = ctx.graph.getNode(parentId)
  if (!parent) return

  for (const childId of parent.childIds) {
    const child = ctx.graph.getNode(childId)
    if (!child?.componentId) {
      applyPropAssignments(ctx, childId, valueByDef, propRefsMap, modified)
      continue
    }

    const refs =
      findPropRefs(ctx, child.componentId, propRefsMap) ??
      fallbackRefsForChild(ctx, child.name, valueByDef)
    applyChildPropRefs(ctx, childId, refs, valueByDef, modified)
    applyPropAssignments(ctx, childId, valueByDef, propRefsMap, modified)
  }
}

/**
 * Apply component property assignments from each instance's own kiwi data.
 *
 * Only processes nodes with their own kiwi NC — cloned instances inherit
 * correct values from their source via transitive sync.
 */
function applyInstanceDirectAssignments(
  ctx: OverrideContext,
  assignmentSources: Map<string, ComponentPropAssignment[]>,
  propRefsMap: Map<string, ComponentPropRef[]>,
  modified: Set<string>
): void {
  for (const node of ctx.graph.getAllNodes()) {
    if (ctx.activeNodeIds && !ctx.activeNodeIds.has(node.id)) continue
    if (node.type !== 'INSTANCE') continue
    const ownFigmaId = ctx.nodeIdToGuid.get(node.id)
    if (!ownFigmaId) continue
    const ownAssignments = assignmentSources.get(ownFigmaId)
    if (ownAssignments) {
      applyPropAssignments(
        ctx,
        node.id,
        assignmentsToValueMap(ctx, ownAssignments),
        propRefsMap,
        modified
      )
    }
  }
}

/**
 * Apply component property assignments from symbolOverrides.
 *
 * These target nested instances via guidPath and may reset values to
 * component defaults (empty kiwi value `{}`).
 */
function applyOverrideAssignments(
  ctx: OverrideContext,
  propRefsMap: Map<string, ComponentPropRef[]>,
  modified: Set<string>
): void {
  for (const [figmaId, nc] of ctx.changeMap) {
    const instanceNodeId = ctx.guidToNodeId.get(figmaId)
    if (!instanceNodeId || (ctx.activeNodeIds && !ctx.activeNodeIds.has(instanceNodeId))) continue
    if (ctx.graph.getNode(instanceNodeId)?.type !== 'INSTANCE') continue

    const overrides = nc.symbolData?.symbolOverrides
    if (!overrides) continue
    for (const ov of overrides) {
      if (!ov.componentPropAssignments?.length) continue

      const guids = ov.guidPath?.guids
      if (!guids?.length) continue

      const targetId = resolveOverrideTarget(ctx, instanceNodeId, guids)
      if (!targetId) continue

      applyPropAssignments(
        ctx,
        targetId,
        assignmentsToValueMap(ctx, ov.componentPropAssignments, true),
        propRefsMap,
        modified
      )
    }
  }
}

/**
 * Apply all component property assignments (visibility toggles, instance swaps).
 *
 * Returns the set of modified node IDs so the caller can run a second
 * transitive sync to propagate the changes to deeper clones.
 */
export function applyComponentProperties(ctx: OverrideContext): Set<string> {
  const modified = new Set<string>()
  const propRefsMap = collectPropRefsMap(ctx)
  if (propRefsMap.size === 0) return modified

  applyInstanceDirectAssignments(ctx, collectAssignmentsMap(ctx), propRefsMap, modified)
  applyOverrideAssignments(ctx, propRefsMap, modified)

  return modified
}
