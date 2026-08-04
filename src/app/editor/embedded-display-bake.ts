import type { SceneNode } from '@open-pencil/scene-graph'

import type { EditorStore } from '@/app/editor/session'
import type { EmbeddedFrameBakeState } from '@/features/embedded-display'

import { renderEmbeddedVisualPng } from './embedded-frame-render'

interface EmbeddedVisualSelection {
  source: SceneNode | null
  reason?: string
}

export function isEmbeddedVisualSource(node: SceneNode | undefined): node is SceneNode {
  if (!node) return false
  if (node.type === 'FRAME') return true
  return node.fills.some((fill) => fill.visible && fill.type === 'IMAGE' && Boolean(fill.imageHash))
}

function sourceKind(node: SceneNode): 'frame' | 'image' {
  return node.type === 'FRAME' ? 'frame' : 'image'
}

function findNearestFrame(store: EditorStore, nodeId: string): SceneNode | null {
  const visited = new Set<string>()
  let node = store.graph.getNode(nodeId)

  while (node && !visited.has(node.id)) {
    visited.add(node.id)
    if (node.type === 'CANVAS') return null
    if (node.type === 'FRAME' && node.id !== store.graph.rootId) return node
    if (!node.parentId) return null
    node = store.graph.getNode(node.parentId)
  }
  return null
}

function resolveEmbeddedVisualSource(store: EditorStore, nodeId: string): SceneNode | null {
  const frame = findNearestFrame(store, nodeId)
  if (frame) return frame
  const node = store.graph.getNode(nodeId)
  return isEmbeddedVisualSource(node) && node.type !== 'FRAME' ? node : null
}

export function getSelectedEmbeddedVisualSources(store: EditorStore): SceneNode[] {
  return [
    ...new Map(
      [...store.state.selectedIds]
        .map((id) => resolveEmbeddedVisualSource(store, id))
        .filter((source): source is SceneNode => source !== null)
        .map((source) => [source.id, source])
    ).values()
  ]
}

export function resolveEmbeddedVisualSelection(store: EditorStore): EmbeddedVisualSelection {
  const selectedIds = [...store.state.selectedIds]
  if (selectedIds.length === 0) {
    return { source: null, reason: '请选择一个 Frame、图片或 Frame 内的元素' }
  }

  const sources = selectedIds.map((id) => resolveEmbeddedVisualSource(store, id))
  const resolvedSources = sources.filter((source): source is SceneNode => source !== null)
  if (resolvedSources.length !== selectedIds.length) {
    return { source: null, reason: '当前选择不是可烧录的 Frame 或图片' }
  }

  const uniqueSources = new Map(resolvedSources.map((source) => [source.id, source]))
  if (uniqueSources.size !== 1) {
    return {
      source: null,
      reason: `已选中 ${uniqueSources.size} 个画面，请使用下方的交互烧录`
    }
  }
  return { source: uniqueSources.values().next().value ?? null }
}

export function getEmbeddedFrameBakeState(store: EditorStore): EmbeddedFrameBakeState {
  const revision = store.state.sceneVersion
  const selection = resolveEmbeddedVisualSelection(store)
  if (!selection.source) {
    return {
      id: '',
      revision,
      available: false,
      sourceKind: 'frame',
      name: '',
      width: 0,
      height: 0,
      reason: selection.reason
    }
  }

  return {
    id: selection.source.id,
    revision,
    available: true,
    sourceKind: sourceKind(selection.source),
    name: selection.source.name,
    width: selection.source.width,
    height: selection.source.height
  }
}

export async function bakeEmbeddedFrameById(
  store: EditorStore,
  frameId: string
): Promise<File | null> {
  const node = store.graph.getNode(frameId)
  if (!isEmbeddedVisualSource(node) || node.id === store.graph.rootId) return null

  const data = await renderEmbeddedVisualPng(store, node.id)
  const baseName = node.name.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, '_') || 'frame'
  return new File([new Uint8Array(data)], `${baseName}.png`, { type: 'image/png' })
}

export async function bakeEmbeddedFrame(store: EditorStore): Promise<File | null> {
  const selection = resolveEmbeddedVisualSelection(store)
  if (!selection.source) return null
  return bakeEmbeddedFrameById(store, selection.source.id)
}
