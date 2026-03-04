import { SceneGraph } from '../scene-graph'

import { guidToString, nodeChangeToProps, convertOverrideToProps, sortChildren } from './kiwi-convert'

import type { NodeChange, GUID } from './codec'

interface SymbolOverride {
  guidPath?: { guids?: GUID[] }
  [key: string]: unknown
}

interface SymbolData {
  symbolID?: GUID
  symbolOverrides?: SymbolOverride[]
}

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

  const overrideKeyToGuid = new Map<string, string>()
  for (const [id, nc] of changeMap) {
    const ok = (nc as unknown as Record<string, unknown>).overrideKey as GUID | undefined
    if (ok) overrideKeyToGuid.set(guidToString(ok), id)
  }

  function createSceneNode(ncId: string, graphParentId: string) {
    if (created.has(ncId)) return
    created.add(ncId)

    const nc = changeMap.get(ncId)
    if (!nc) return

    const { nodeType, ...props } = nodeChangeToProps(nc, blobs)
    if (nodeType === 'DOCUMENT' || nodeType === 'VARIABLE') return

    const node = graph.createNode(nodeType, graphParentId, props)
    guidToNodeId.set(ncId, node.id)

    for (const childId of getChildren(ncId)) {
      createSceneNode(childId, node.id)
    }
  }

  function importVariables() {
    for (const [id, nc] of changeMap) {
      if (nc.type !== 'VARIABLE') continue
      const varData = (
        nc as unknown as {
          variableData?: {
            value?: { boolValue?: boolean; textValue?: string; floatValue?: number }
            dataType?: string
          }
        }
      ).variableData
      if (!varData) continue

      const parentId = parentMap.get(id) ?? ''
      const parentNc = changeMap.get(parentId)
      const collectionName = parentNc?.name ?? 'Variables'
      const collectionId = parentId

      if (!graph.variableCollections.has(collectionId)) {
        graph.addCollection({
          id: collectionId,
          name: collectionName,
          modes: [{ modeId: 'default', name: 'Default' }],
          defaultModeId: 'default',
          variableIds: []
        })
      }

      let type: import('../scene-graph').VariableType = 'FLOAT'
      let value: import('../scene-graph').VariableValue = 0
      const dt = varData.dataType
      const v = varData.value

      if (dt === 'BOOLEAN' || dt === '0') {
        type = 'BOOLEAN'
        value = v?.boolValue ?? false
      } else if (dt === 'STRING' || dt === '2') {
        type = 'STRING'
        value = v?.textValue ?? ''
      } else {
        type = 'FLOAT'
        value = v?.floatValue ?? 0
      }

      graph.addVariable({
        id,
        name: nc.name ?? 'Variable',
        type,
        collectionId,
        valuesByMode: { default: value },
        description: '',
        hiddenFromPublishing: false
      })
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

  // Remap componentId from original Figma GUIDs to imported node IDs
  for (const node of graph.getAllNodes()) {
    if (node.type !== 'INSTANCE' || !node.componentId) continue
    const remapped = guidToNodeId.get(node.componentId)
    if (remapped) node.componentId = remapped
  }

  // Populate instance children from their components.
  // Multiple passes needed: cloning creates new instance nodes that
  // themselves need population.
  let populated = 1
  while (populated > 0) {
    populated = 0
    for (const node of graph.getAllNodes()) {
      if (node.type !== 'INSTANCE' || !node.componentId || node.childIds.length > 0) continue
      const comp = graph.getNode(node.componentId)
      if (comp && comp.childIds.length > 0) {
        graph.populateInstanceChildren(node.id, node.componentId)
        populated++
      }
    }
  }

  // Apply symbol overrides to instance children.
  // symbolOverrides guidPaths reference nodes by overrideKey, not guid.
  const componentIdRoot = new Map<string, string>()
  function getComponentRoot(nodeId: string): string {
    if (componentIdRoot.has(nodeId)) return componentIdRoot.get(nodeId) ?? nodeId
    const node = graph.getNode(nodeId)
    if (!node?.componentId) {
      componentIdRoot.set(nodeId, nodeId)
      return nodeId
    }
    const root = getComponentRoot(node.componentId)
    componentIdRoot.set(nodeId, root)
    return root
  }

  function findDescendantByComponentId(parentId: string, componentId: string): string | null {
    const targetRoot = getComponentRoot(componentId)
    const parent = graph.getNode(parentId)
    if (!parent) return null
    for (const childId of parent.childIds) {
      const child = graph.getNode(childId)
      if (!child) continue
      if (child.componentId && getComponentRoot(child.componentId) === targetRoot) return childId
      const deep = findDescendantByComponentId(childId, componentId)
      if (deep) return deep
    }
    return null
  }

  function resolveOverrideTarget(instanceId: string, guids: GUID[]): string | null {
    let currentId = instanceId
    for (const guid of guids) {
      const key = guidToString(guid)
      const figmaGuid = overrideKeyToGuid.get(key) ?? key
      const remapped = guidToNodeId.get(figmaGuid)
      if (!remapped) return null
      const found = findDescendantByComponentId(currentId, remapped)
      if (!found) return null
      currentId = found
    }
    return currentId
  }

  const overriddenNodes = new Set<string>()

  function applySymbolOverrides() {
    componentIdRoot.clear()

    for (const [ncId, nc] of changeMap) {
      if (nc.type !== 'INSTANCE') continue
      const sd = (nc as unknown as Record<string, unknown>).symbolData as SymbolData | undefined
      if (!sd?.symbolOverrides?.length) continue

      const nodeId = guidToNodeId.get(ncId)
      if (!nodeId) continue

      for (const ov of sd.symbolOverrides) {
        const guids = ov.guidPath?.guids
        if (!guids?.length) continue

        const targetId = resolveOverrideTarget(nodeId, guids)
        if (!targetId) continue

        overriddenNodes.add(targetId)

        // Instance swap: replace target's component and re-populate children
        const swapGuid = (ov as Record<string, unknown>).overriddenSymbolID as GUID | undefined
        if (swapGuid) {
          const swapFigmaId = guidToString(swapGuid)
          const newCompId = guidToNodeId.get(swapFigmaId)
          const target = graph.getNode(targetId)
          if (newCompId && target?.type === 'INSTANCE') {
            for (const childId of [...target.childIds]) graph.deleteNode(childId)
            graph.updateNode(targetId, { componentId: newCompId })
            const newComp = graph.getNode(newCompId)
            if (newComp && newComp.childIds.length > 0) {
              graph.populateInstanceChildren(targetId, newCompId)
            }
            componentIdRoot.clear()
          }
        }

        const { guidPath: _, overriddenSymbolID: _s, ...fields } = ov as Record<string, unknown>
        if (Object.keys(fields).length === 0) continue

        const updates = convertOverrideToProps(fields as Record<string, unknown>)
        if (Object.keys(updates).length > 0) {
          graph.updateNode(targetId, updates)
        }
      }
    }
  }

  applySymbolOverrides()

  if (overriddenNodes.size > 0) {
    // Build reverse map: source → clones
    const clonesOf = new Map<string, string[]>()
    for (const node of graph.getAllNodes()) {
      if (!node.componentId) continue
      let arr = clonesOf.get(node.componentId)
      if (!arr) { arr = []; clonesOf.set(node.componentId, arr) }
      arr.push(node.id)
    }

    // BFS from overridden nodes to find all transitive clones
    const needsSync = new Set<string>()
    const queue = [...overriddenNodes]
    for (let id = queue.pop(); id !== undefined; id = queue.pop()) {
      const clones = clonesOf.get(id)
      if (!clones) continue
      for (const cloneId of clones) {
        if (needsSync.has(cloneId)) continue
        needsSync.add(cloneId)
        queue.push(cloneId)
      }
    }

    // Sync each clone from its source. Process in BFS order (closest to
    // overridden node first) so sources are updated before their clones.
    const visited = new Set<string>()
    const syncQueue = [...overriddenNodes]
    for (let sourceId = syncQueue.shift(); sourceId !== undefined; sourceId = syncQueue.shift()) {
      const clones = clonesOf.get(sourceId)
      if (!clones) continue
      const source = graph.getNode(sourceId)
      if (!source) continue

      for (const cloneId of clones) {
        if (!needsSync.has(cloneId) || visited.has(cloneId)) continue
        visited.add(cloneId)
        const node = graph.getNode(cloneId)
        if (!node) continue

        // Instance swap: re-populate children from source
        if (node.type === 'INSTANCE' && source.type === 'INSTANCE' && node.componentId) {
          for (const childId of [...node.childIds]) graph.deleteNode(childId)
          graph.populateInstanceChildren(node.id, node.componentId)
        } else {
          // Property sync
          const updates: Partial<import('../scene-graph').SceneNode> = {}
          if (source.text !== node.text) updates.text = source.text
          if (source.visible !== node.visible) updates.visible = source.visible
          if (source.opacity !== node.opacity) updates.opacity = source.opacity
          if (source.name !== node.name) updates.name = source.name
          if (source.fills !== node.fills) updates.fills = structuredClone(source.fills)
          if (source.strokes !== node.strokes) updates.strokes = structuredClone(source.strokes)
          if (source.effects !== node.effects) updates.effects = structuredClone(source.effects)
          if (source.styleRuns !== node.styleRuns) updates.styleRuns = structuredClone(source.styleRuns)
          if (source.layoutGrow !== node.layoutGrow) updates.layoutGrow = source.layoutGrow
          if (source.textAutoResize !== node.textAutoResize) updates.textAutoResize = source.textAutoResize
          if (source.locked !== node.locked) updates.locked = source.locked
          if (Object.keys(updates).length > 0) graph.updateNode(node.id, updates)
        }

        syncQueue.push(cloneId)
      }
    }
  }

  // Ensure at least one page exists
  if (graph.getPages(true).length === 0) {
    graph.addPage('Page 1')
  }

  return graph
}
