import { computeAllLayouts } from '../layout'
import {
  buildFigmaClipboardHTML,
  importClipboardNodes,
  parseFigmaClipboard
} from '../clipboard'
import { collectFontKeys } from '../fonts'
import { computeImageHash } from '../figma-api'

import type { SceneGraph, SceneNode } from '../scene-graph'
import type { Vector } from '../types'
import type { EditorContext } from './types'

export function createClipboardActions(ctx: EditorContext) {
  function collectSubtrees(g: SceneGraph, rootIds: string[]): SceneNode[] {
    const result: SceneNode[] = []
    function walk(id: string) {
      const node = g.getNode(id)
      if (!node) return
      result.push({ ...node })
      for (const childId of node.childIds) walk(childId)
    }
    for (const id of rootIds) walk(id)
    return result
  }

  function centerNodesAt(nodeIds: string[], cx: number, cy: number) {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const id of nodeIds) {
      const n = ctx.graph.getNode(id)
      if (!n) continue
      minX = Math.min(minX, n.x)
      minY = Math.min(minY, n.y)
      maxX = Math.max(maxX, n.x + n.width)
      maxY = Math.max(maxY, n.y + n.height)
    }
    if (minX === Infinity) return
    const dx = cx - (minX + maxX) / 2
    const dy = cy - (minY + maxY) / 2
    for (const id of nodeIds) {
      const n = ctx.graph.getNode(id)
      if (n) ctx.graph.updateNode(id, { x: n.x + dx, y: n.y + dy })
    }
  }

  async function loadFontsForNodes(nodeIds: string[]) {
    const toLoad = collectFontKeys(ctx.graph, nodeIds)
    if (toLoad.length === 0) return []

    const results = await Promise.all(toLoad.map(([family, style]) => ctx.loadFont(family, style)))
    const failed = toLoad.filter((_, i) => results[i] === null)
    computeAllLayouts(ctx.graph, ctx.state.currentPageId)
    return failed
  }

  function duplicateSelected(selectedNodes: SceneNode[]) {
    const prevSelection = new Set(ctx.state.selectedIds)
    const newIds: string[] = []
    const snapshots: Array<{ id: string; parentId: string; snapshot: SceneNode }> = []

    for (const node of selectedNodes) {
      const parentId = node.parentId ?? ctx.state.currentPageId
      const { id: _srcId, parentId: _srcParent, childIds: _srcChildren, ...srcRest } = node
      const created = ctx.graph.createNode(node.type, parentId, {
        ...srcRest,
        name: node.name + ' copy',
        x: node.x + 20,
        y: node.y + 20
      })
      newIds.push(created.id)
      snapshots.push({ id: created.id, parentId, snapshot: { ...created } })
    }

    if (newIds.length > 0) {
      ctx.state.selectedIds = new Set(newIds)
      ctx.undo.push({
        label: 'Duplicate',
        forward: () => {
          for (const { snapshot, parentId } of snapshots) {
            ctx.graph.createNode(snapshot.type, parentId, snapshot)
          }
          ctx.state.selectedIds = new Set(newIds)
        },
        inverse: () => {
          for (const { id } of snapshots) ctx.graph.deleteNode(id)
          ctx.state.selectedIds = prevSelection
        }
      })
    }
  }

  function writeCopyData(clipboardData: DataTransfer, selectedNodes: SceneNode[]) {
    if (selectedNodes.length === 0) return

    const names = selectedNodes.map((n) => n.name).join('\n')
    const html = buildFigmaClipboardHTML(selectedNodes, ctx.graph)
    if (html) clipboardData.setData('text/html', html)
    clipboardData.setData('text/plain', names)
  }

  function pasteFromHTML(html: string, cursorPos?: Vector) {
    void parseFigmaClipboard(html).then((figma) => {
      if (figma) {
        const prevSelection = new Set(ctx.state.selectedIds)
        const created = importClipboardNodes(
          figma.nodes,
          ctx.graph,
          ctx.state.currentPageId,
          0,
          0,
          figma.blobs
        )
        if (created.length > 0) {
          const { width: viewW, height: viewH } = ctx.getViewportSize()
          const cx = cursorPos?.x ?? (-ctx.state.panX + viewW / 2) / ctx.state.zoom
          const cy = cursorPos?.y ?? (-ctx.state.panY + viewH / 2) / ctx.state.zoom
          centerNodesAt(created, cx, cy)
          computeAllLayouts(ctx.graph, ctx.state.currentPageId)
          ctx.state.selectedIds = new Set(created)

          const allNodes = collectSubtrees(ctx.graph, created)
          const pageId = ctx.state.currentPageId
          ctx.undo.push({
            label: 'Paste',
            forward: () => {
              for (const snapshot of allNodes) {
                ctx.graph.createNode(snapshot.type, snapshot.parentId ?? pageId, {
                  ...snapshot,
                  childIds: []
                })
              }
              computeAllLayouts(ctx.graph, pageId)
              ctx.state.selectedIds = new Set(created)
            },
            inverse: () => {
              for (const id of [...created].reverse()) ctx.graph.deleteNode(id)
              computeAllLayouts(ctx.graph, pageId)
              ctx.state.selectedIds = prevSelection
            }
          })
          void loadFontsForNodes(created)
          warnMissingImages(created)
        }
      }
    })
  }

  function warnMissingImages(nodeIds: string[]) {
    const allNodes = collectSubtrees(ctx.graph, nodeIds)
    return allNodes.some((n) =>
      n.fills.some((f) => f.type === 'IMAGE' && f.imageHash && !ctx.graph.images.has(f.imageHash))
    )
  }

  function deleteSelected() {
    const entries: Array<{ id: string; parentId: string; snapshot: SceneNode; index: number }> = []
    for (const id of ctx.state.selectedIds) {
      const node = ctx.graph.getNode(id)
      if (!node || node.locked) continue
      const parentId = node.parentId ?? ctx.state.currentPageId
      const parent = ctx.graph.getNode(parentId)
      const index = parent?.childIds.indexOf(id) ?? -1
      entries.push({ id, parentId, snapshot: { ...node }, index })
    }
    if (entries.length === 0) return

    const prevSelection = new Set(ctx.state.selectedIds)
    for (const { id } of entries) ctx.graph.deleteNode(id)

    ctx.undo.push({
      label: 'Delete',
      forward: () => {
        for (const { id } of entries) ctx.graph.deleteNode(id)
        ctx.state.selectedIds = new Set()
      },
      inverse: () => {
        for (const { snapshot, parentId, index } of [...entries].reverse()) {
          ctx.graph.createNode(snapshot.type, parentId, snapshot)
          if (index >= 0) {
            ctx.graph.reorderChild(snapshot.id, parentId, index)
          }
        }
        ctx.state.selectedIds = prevSelection
      }
    })
    ctx.state.selectedIds = new Set()
  }

  function storeImage(bytes: Uint8Array): string {
    const hash = computeImageHash(bytes)
    ctx.graph.images.set(hash, bytes)
    return hash
  }

  return {
    collectSubtrees,
    centerNodesAt,
    loadFontsForNodes,
    duplicateSelected,
    writeCopyData,
    pasteFromHTML,
    warnMissingImages,
    deleteSelected,
    storeImage
  }
}
