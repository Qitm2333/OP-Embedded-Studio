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
  // Each override has a guidPath (chain of original Figma GUIDs) targeting
  // a descendant. We resolve it by walking cloned children via componentId.
  // Build a set of all node IDs that are transitively cloned from a given
  // component node. componentId chains: clone → source → source's source → ...
  // We cache the root of each chain for fast lookup.
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
      const figmaId = guidToString(guid)
      const remapped = guidToNodeId.get(figmaId)
      if (!remapped) return null
      const found = findDescendantByComponentId(currentId, remapped)
      if (!found) return null
      currentId = found
    }
    return currentId
  }

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

      const { guidPath: _, ...fields } = ov
      if (Object.keys(fields).length === 0) continue

      const updates = convertOverrideToProps(fields)
      if (Object.keys(updates).length > 0) {
        graph.updateNode(targetId, updates)
      }
    }
  }

  // Ensure at least one page exists
  if (graph.getPages(true).length === 0) {
    graph.addPage('Page 1')
  }

  return graph
}
