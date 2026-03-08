import type { VariableType, VariableValue } from '../scene-graph'
import { SceneGraph } from '../scene-graph'

import { guidToString, nodeChangeToProps, sortChildren } from './kiwi-convert'
import { populateAndApplyOverrides } from './instance-overrides'
import type { InstanceNodeChange } from './instance-overrides'

import type { NodeChange } from './codec'

export function importNodeChanges(
  nodeChanges: NodeChange[],
  blobs: Uint8Array[] = [],
  images?: Map<string, Uint8Array>
): SceneGraph {
  const graph = new SceneGraph()

  if (images) {
    for (const [hash, data] of images) {
      graph.images.set(hash, data)
    }
  }

  // Remove the default page created by constructor — we'll create pages from the file
  for (const page of graph.getPages(true)) {
    graph.deleteNode(page.id)
  }

  const changeMap = new Map<string, NodeChange>()
  const parentMap = new Map<string, string>()
  const childrenMap = new Map<string, string[]>()

  for (const nc of nodeChanges) {
    if (!nc.guid) continue
    if (nc.phase === 'REMOVED') continue
    const id = guidToString(nc.guid)
    changeMap.set(id, nc)

    if (nc.parentIndex?.guid) {
      const pid = guidToString(nc.parentIndex.guid)
      parentMap.set(id, pid)
      let siblings = childrenMap.get(pid)
      if (!siblings) {
        siblings = []
        childrenMap.set(pid, siblings)
      }
      siblings.push(id)
    }
  }

  for (const [parentId, children] of childrenMap) {
    const parentNc = changeMap.get(parentId)
    if (parentNc) sortChildren(children, parentNc, changeMap)
  }

  function getChildren(ncId: string): string[] {
    return childrenMap.get(ncId) ?? []
  }

  const created = new Set<string>()
  const guidToNodeId = new Map<string, string>()

  function createSceneNode(ncId: string, graphParentId: string) {
    if (created.has(ncId)) return
    created.add(ncId)

    const nc = changeMap.get(ncId)
    if (!nc) return

    const { nodeType, ...props } = nodeChangeToProps(nc, blobs)
    if (nodeType === 'DOCUMENT' || nodeType === 'VARIABLE' || nc.type === 'VARIABLE_SET') return

    const node = graph.createNode(nodeType, graphParentId, props)
    guidToNodeId.set(ncId, node.id)

    for (const childId of getChildren(ncId)) {
      createSceneNode(childId, node.id)
    }
  }

  function importVariables() {
    const modeGuidToId = new Map<string, string>()

    for (const [id, nc] of changeMap) {
      if (nc.type !== 'VARIABLE_SET') continue

      const modes = (nc.variableSetModes ?? []).map(
        (m: { id?: { sessionID: number; localID: number }; name?: string }) => {
          const modeId = m.id ? guidToString(m.id) : 'default'
          if (m.id) modeGuidToId.set(modeId, modeId)
          return { modeId, name: m.name ?? 'Mode' }
        }
      )
      if (modes.length === 0) modes.push({ modeId: 'default', name: 'Default' })

      graph.addCollection({
        id,
        name: nc.name ?? 'Variables',
        modes,
        defaultModeId: modes[0].modeId,
        variableIds: []
      })
    }

    for (const [id, nc] of changeMap) {
      if (nc.type !== 'VARIABLE') continue

      const setIdObj = nc.variableSetID as { guid?: { sessionID: number; localID: number } } | undefined
      const collectionId = setIdObj?.guid ? guidToString(setIdObj.guid) : (parentMap.get(id) ?? '')

      if (!graph.variableCollections.has(collectionId)) {
        const parentNc = changeMap.get(collectionId)
        graph.addCollection({
          id: collectionId,
          name: parentNc?.name ?? 'Variables',
          modes: [{ modeId: 'default', name: 'Default' }],
          defaultModeId: 'default',
          variableIds: []
        })
      }

      const resolvedType = nc.variableResolvedType as string | undefined
      let type: VariableType = 'FLOAT'
      if (resolvedType === 'COLOR') type = 'COLOR'
      else if (resolvedType === 'BOOLEAN') type = 'BOOLEAN'
      else if (resolvedType === 'STRING') type = 'STRING'

      const valuesByMode: Record<string, VariableValue> = {}
      const dataValues = nc.variableDataValues as { entries?: Array<{ modeID?: { sessionID: number; localID: number }; variableData?: { value?: Record<string, unknown>; dataType?: string; resolvedDataType?: string } }> } | undefined

      if (dataValues?.entries) {
        for (const entry of dataValues.entries) {
          const modeId = entry.modeID ? guidToString(entry.modeID) : 'default'
          const vd = entry.variableData
          if (!vd?.value) continue

          const dt = vd.dataType ?? vd.resolvedDataType
          if (dt === 'COLOR' && vd.value.colorValue) {
            const c = vd.value.colorValue as { r: number; g: number; b: number; a: number }
            valuesByMode[modeId] = { r: c.r, g: c.g, b: c.b, a: c.a }
          } else if (dt === 'BOOLEAN') {
            valuesByMode[modeId] = (vd.value.boolValue as boolean) ?? false
          } else if (dt === 'STRING') {
            valuesByMode[modeId] = (vd.value.textValue as string) ?? ''
          } else if (dt === 'ALIAS' && vd.value.alias) {
            const alias = vd.value.alias as { guid?: { sessionID: number; localID: number } }
            if (alias.guid) valuesByMode[modeId] = { aliasId: guidToString(alias.guid) }
          } else {
            valuesByMode[modeId] = (vd.value.floatValue as number) ?? 0
          }
        }
      }

      if (Object.keys(valuesByMode).length === 0) {
        const col = graph.variableCollections.get(collectionId)
        const defaultMode = col?.defaultModeId ?? 'default'
        valuesByMode[defaultMode] = type === 'BOOLEAN' ? false : type === 'STRING' ? '' : type === 'COLOR' ? { r: 0, g: 0, b: 0, a: 1 } : 0
      }

      graph.addVariable({
        id,
        name: nc.name ?? 'Variable',
        type,
        collectionId,
        valuesByMode,
        description: '',
        hiddenFromPublishing: false
      })
    }
  }

  function importVariableBindings() {
    const fieldMap: Record<string, string> = {
      CORNER_RADIUS: 'cornerRadius',
      RECTANGLE_TOP_LEFT_CORNER_RADIUS: 'topLeftRadius',
      RECTANGLE_TOP_RIGHT_CORNER_RADIUS: 'topRightRadius',
      RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS: 'bottomLeftRadius',
      RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS: 'bottomRightRadius',
      STROKE_WEIGHT: 'strokeWeight',
      STACK_SPACING: 'itemSpacing',
      STACK_PADDING_LEFT: 'paddingLeft',
      STACK_PADDING_TOP: 'paddingTop',
      STACK_PADDING_RIGHT: 'paddingRight',
      STACK_PADDING_BOTTOM: 'paddingBottom',
      STACK_COUNTER_SPACING: 'counterAxisSpacing',
      VISIBLE: 'visible',
      OPACITY: 'opacity',
      WIDTH: 'width',
      HEIGHT: 'height',
      FONT_SIZE: 'fontSize',
      LETTER_SPACING: 'letterSpacing',
      LINE_HEIGHT: 'lineHeight'
    }

    for (const [ncId, nc] of changeMap) {
      const consumption = nc.variableConsumptionMap as { entries?: Array<{ variableData?: { value?: { alias?: { guid?: { sessionID: number; localID: number } } } }; variableField?: string }> } | undefined
      if (!consumption?.entries?.length) continue

      const nodeId = guidToNodeId.get(ncId)
      if (!nodeId) continue

      for (const entry of consumption.entries) {
        const alias = entry.variableData?.value?.alias
        if (!alias?.guid) continue
        const variableId = guidToString(alias.guid)
        const field = fieldMap[entry.variableField ?? '']
        if (field) graph.bindVariable(nodeId, field, variableId)
      }
    }
  }

  // Find the document node (type=DOCUMENT or guid 0:0)
  let docId: string | null = null
  for (const [id, nc] of changeMap) {
    if (nc.type === 'DOCUMENT' || id === '0:0') {
      docId = id
      break
    }
  }

  if (docId) {
    // Import pages (CANVAS nodes) and their children
    for (const canvasId of getChildren(docId)) {
      const canvasNc = changeMap.get(canvasId)
      if (!canvasNc) continue
      if (canvasNc.type === 'CANVAS') {
        const page = graph.addPage(canvasNc.name ?? 'Page')
        if (canvasNc.internalOnly) page.internalOnly = true
        created.add(canvasId)
        for (const childId of getChildren(canvasId)) {
          createSceneNode(childId, page.id)
        }
      } else {
        createSceneNode(canvasId, graph.getPages()[0]?.id ?? graph.rootId)
      }
    }
  } else {
    // No document structure — treat all roots as children of the first page
    const roots: string[] = []
    for (const [id] of changeMap) {
      const pid = parentMap.get(id)
      if (!pid || !changeMap.has(pid)) roots.push(id)
    }
    const page = graph.getPages()[0] ?? graph.addPage('Page 1')
    for (const rootId of roots) {
      createSceneNode(rootId, page.id)
    }
  }

  importVariables()
  importVariableBindings()

  // Remap componentId from original Figma GUIDs to imported node IDs
  for (const node of graph.getAllNodes()) {
    if (node.type !== 'INSTANCE' || !node.componentId) continue
    const remapped = guidToNodeId.get(node.componentId)
    if (remapped) node.componentId = remapped
  }

  populateAndApplyOverrides(
    graph,
    changeMap as unknown as Map<string, InstanceNodeChange>,
    guidToNodeId,
    blobs
  )

  // Ensure at least one page exists
  if (graph.getPages(true).length === 0) {
    graph.addPage('Page 1')
  }

  return graph
}
