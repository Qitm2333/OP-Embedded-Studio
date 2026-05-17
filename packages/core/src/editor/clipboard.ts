import {
  importClipboardNodes,
  parseFigmaClipboard,
  parseOpenPencilClipboard
} from '#core/clipboard'
import { computeAbsoluteBounds } from '#core/geometry'
import { computeAllLayouts } from '#core/layout'
import type { SceneNode } from '#core/scene-graph'
import type { Vector } from '#core/types'

import { createClipboardCopyActions } from './clipboard/copy'
import { createClipboardExportActions } from './clipboard/export'
import { createClipboardFontActions } from './clipboard/fonts'
import { createClipboardImageActions } from './clipboard/images'
import { resolvePasteTarget } from './clipboard/paste-target'
import { createClipboardPlacementActions } from './clipboard/placement'
import { collectSubtrees, restoreSubtree, snapshotSubtree } from './clipboard/subtree-history'
import type { EditorContext } from './types'

type PasteOptions = {
  replaceSelection?: boolean
}

type DeletedEntry = {
  id: string
  parentId: string
  index: number
  subtree: Map<string, SceneNode>
}

export function createClipboardActions(ctx: EditorContext) {
  function duplicateSelected(selectedNodes: SceneNode[]) {
    const prevSelection = new Set(ctx.state.selectedIds)
    const selectedSet = new Set(selectedNodes.map((n) => n.id))
    const topLevel = selectedNodes.filter((n) => !n.parentId || !selectedSet.has(n.parentId))

    const newRootIds: string[] = []
    const allSnapshots = new Map<string, SceneNode>()

    for (const node of topLevel) {
      const parentId = node.parentId ?? ctx.state.currentPageId
      const clone = ctx.graph.cloneTree(node.id, parentId, {
        name: node.name + ' copy',
        x: node.x + 20,
        y: node.y + 20
      })
      if (!clone) continue
      newRootIds.push(clone.id)
      const subtree = snapshotSubtree(ctx.graph, clone.id)
      for (const [id, snap] of subtree) allSnapshots.set(id, snap)
    }

    if (newRootIds.length > 0) {
      ctx.setSelectedIds(new Set(newRootIds))
      ctx.undo.push({
        label: 'Duplicate',
        forward: () => {
          for (const rootId of newRootIds) {
            const snapshot = allSnapshots.get(rootId)
            if (!snapshot) continue
            const parentId = snapshot.parentId ?? ctx.state.currentPageId
            restoreSubtree(ctx.graph, snapshot, parentId, allSnapshots)
          }
          ctx.setSelectedIds(new Set(newRootIds))
        },
        inverse: () => {
          for (const id of newRootIds.slice().reverse()) ctx.graph.deleteNode(id)
          ctx.setSelectedIds(prevSelection)
        }
      })
    }
  }

  function recreateSnapshots(snapshots: SceneNode[], pageId: string) {
    for (const snapshot of snapshots) {
      ctx.graph.createNode(snapshot.type, snapshot.parentId ?? pageId, {
        ...snapshot,
        childIds: []
      })
    }
  }

  function deleteIds(ids: string[]) {
    for (const id of [...ids].reverse()) ctx.graph.deleteNode(id)
  }

  function restoreDeletedEntries(entries: DeletedEntry[]) {
    for (const { id, parentId, index, subtree } of [...entries].reverse()) {
      const rootSnap = subtree.get(id)
      if (rootSnap) restoreSubtree(ctx.graph, rootSnap, parentId, subtree)
      if (index >= 0) ctx.graph.reorderChild(id, parentId, index)
    }
  }

  function pushPasteUndo(created: string[], prevSelection: Set<string>) {
    const allNodes = collectSubtrees(ctx.graph, created)
    const pageId = ctx.state.currentPageId
    ctx.undo.push({
      label: 'Paste',
      forward: () => {
        recreateSnapshots(allNodes, pageId)
        computeAllLayouts(ctx.graph, pageId)
        ctx.setSelectedIds(new Set(created))
      },
      inverse: () => {
        deleteIds(created)
        computeAllLayouts(ctx.graph, pageId)
        ctx.setSelectedIds(prevSelection)
      }
    })
  }

  function selectedReplacementTargets() {
    const selected = [...ctx.state.selectedIds]
      .map((id) => ctx.graph.getNode(id))
      .filter((node): node is SceneNode => node != null && !node.locked)
    const selectedSet = new Set(selected.map((node) => node.id))
    return selected.filter((node) => !node.parentId || !selectedSet.has(node.parentId))
  }

  function pushPasteReplaceUndo(
    created: string[],
    deleted: DeletedEntry[],
    prevSelection: Set<string>
  ) {
    const createdSnapshots = collectSubtrees(ctx.graph, created)
    const pageId = ctx.state.currentPageId
    ctx.undo.push({
      label: 'Paste to replace',
      forward: () => {
        for (const { id } of deleted) ctx.graph.deleteNode(id)
        recreateSnapshots(createdSnapshots, pageId)
        computeAllLayouts(ctx.graph, pageId)
        ctx.setSelectedIds(new Set(created))
      },
      inverse: () => {
        deleteIds(created)
        restoreDeletedEntries(deleted)
        computeAllLayouts(ctx.graph, pageId)
        ctx.setSelectedIds(prevSelection)
      }
    })
  }

  function replaceTargetsWithCreated(
    created: string[],
    targets: SceneNode[],
    prevSelection: Set<string>
  ) {
    if (created.length === 0 || targets.length === 0) return false
    const deleted = targets.map((node) => {
      const parentId = node.parentId ?? ctx.state.currentPageId
      const parent = ctx.graph.getNode(parentId)
      return {
        id: node.id,
        parentId,
        index: parent?.childIds.indexOf(node.id) ?? -1,
        subtree: snapshotSubtree(ctx.graph, node.id)
      }
    })

    const targetBounds = computeAbsoluteBounds(targets, (id) => ctx.graph.getAbsolutePosition(id))
    placementActions.centerNodesAt(
      created,
      targetBounds.x + targetBounds.width / 2,
      targetBounds.y + targetBounds.height / 2
    )
    const insertParentId = deleted[0]?.parentId ?? ctx.state.currentPageId
    const insertIndex = deleted[0]?.index ?? 0
    for (let i = 0; i < created.length; i++) ctx.graph.reorderChild(created[i], insertParentId, insertIndex + i)
    for (const { id } of deleted) ctx.graph.deleteNode(id)
    computeAllLayouts(ctx.graph, ctx.state.currentPageId)
    ctx.setSelectedIds(new Set(created))
    pushPasteReplaceUndo(created, deleted, prevSelection)
    return true
  }

  async function pasteFromHTML(html: string, cursorPos?: Vector, options: PasteOptions = {}) {
    const openPencil = parseOpenPencilClipboard(html)
    if (openPencil) {
      pasteOpenPencilNodes(openPencil.nodes, openPencil.images, cursorPos, options)
      return
    }

    const figma = await parseFigmaClipboard(html)
    if (figma) {
      const prevSelection = new Set(ctx.state.selectedIds)
      const replacementTargets = options.replaceSelection ? selectedReplacementTargets() : []
      const pasteTarget = replacementTargets[0]?.parentId ?? resolvePasteTarget(ctx)
      const created = importClipboardNodes(figma.nodes, ctx.graph, pasteTarget, 0, 0, figma.blobs)
      if (created.length > 0) {
        if (replacementTargets.length > 0) {
          replaceTargetsWithCreated(created, replacementTargets, prevSelection)
          void fontActions.loadFontsForNodes(created)
          warnMissingImages(created)
          ctx.requestRender()
          return
        }
        const { width: viewW, height: viewH } = ctx.getViewportSize()
        const cx = cursorPos?.x ?? (-ctx.state.panX + viewW / 2) / ctx.state.zoom
        const cy = cursorPos?.y ?? (-ctx.state.panY + viewH / 2) / ctx.state.zoom
        placementActions.centerNodesAt(created, cx, cy)
        computeAllLayouts(ctx.graph, ctx.state.currentPageId)
        ctx.setSelectedIds(new Set(created))

        pushPasteUndo(created, prevSelection)
        void fontActions.loadFontsForNodes(created)
        warnMissingImages(created)
        ctx.requestRender()
      }
    }
  }

  function pasteOpenPencilNodes(
    nodes: Array<SceneNode & { children?: SceneNode[] }>,
    images: Map<string, Uint8Array>,
    cursorPos?: Vector,
    options: PasteOptions = {}
  ) {
    const prevSelection = new Set(ctx.state.selectedIds)
    const replacementTargets = options.replaceSelection ? selectedReplacementTargets() : []
    for (const [hash, bytes] of images) ctx.graph.images.set(hash, bytes)

    const created: string[] = []
    const createNodeTree = (source: SceneNode & { children?: SceneNode[] }, parentId: string) => {
      const { id: _id, childIds: _childIds, children = [], parentId: _parentId, ...rest } = source
      const node = ctx.graph.createNode(source.type, parentId, {
        ...structuredClone(rest),
        x: source.x + 20,
        y: source.y + 20,
        childIds: []
      })
      for (const child of children) createNodeTree(child, node.id)
      return node.id
    }

    const pasteTarget = replacementTargets[0]?.parentId ?? resolvePasteTarget(ctx)
    for (const node of nodes) created.push(createNodeTree(node, pasteTarget))
    if (created.length === 0) return

    if (replacementTargets.length > 0) {
      replaceTargetsWithCreated(created, replacementTargets, prevSelection)
      return
    }

    if (cursorPos) placementActions.centerNodesAt(created, cursorPos.x, cursorPos.y)
    computeAllLayouts(ctx.graph, ctx.state.currentPageId)
    ctx.setSelectedIds(new Set(created))

    pushPasteUndo(created, prevSelection)
  }

  function warnMissingImages(nodeIds: string[]) {
    const allNodes = collectSubtrees(ctx.graph, nodeIds)
    return allNodes.some((n) =>
      n.fills.some((f) => f.type === 'IMAGE' && f.imageHash && !ctx.graph.images.has(f.imageHash))
    )
  }

  function deleteSelected() {
    const entries: Array<{
      id: string
      parentId: string
      index: number
      subtree: Map<string, SceneNode>
    }> = []
    for (const id of ctx.state.selectedIds) {
      const node = ctx.graph.getNode(id)
      if (!node || node.locked) continue
      const parentId = node.parentId ?? ctx.state.currentPageId
      const parent = ctx.graph.getNode(parentId)
      const index = parent?.childIds.indexOf(id) ?? -1
      entries.push({ id, parentId, index, subtree: snapshotSubtree(ctx.graph, id) })
    }
    if (entries.length === 0) return

    const prevSelection = new Set(ctx.state.selectedIds)
    for (const { id } of entries) ctx.graph.deleteNode(id)

    ctx.undo.push({
      label: 'Delete',
      forward: () => {
        for (const { id } of entries) ctx.graph.deleteNode(id)
        ctx.setSelectedIds(new Set())
      },
      inverse: () => {
        restoreDeletedEntries(entries)
        ctx.setSelectedIds(prevSelection)
      }
    })
    ctx.setSelectedIds(new Set())
  }

  const copyActions = createClipboardCopyActions(ctx)
  const exportActions = createClipboardExportActions(ctx)
  const fontActions = createClipboardFontActions(ctx)
  const imageActions = createClipboardImageActions(ctx)
  const placementActions = createClipboardPlacementActions(ctx)

  return {
    collectSubtrees,
    ...placementActions,
    ...fontActions,
    duplicateSelected,
    ...copyActions,
    pasteFromHTML,
    warnMissingImages,
    deleteSelected,
    ...imageActions,
    ...exportActions
  }
}
