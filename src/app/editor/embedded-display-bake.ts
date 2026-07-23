import type { SceneNode } from '@open-pencil/scene-graph'

import type { EditorStore } from '@/app/editor/session'
import type { EmbeddedFrameBakeState } from '@/features/embedded-display'

import { renderEmbeddedFramePng } from './embedded-frame-render'

interface EmbeddedFrameSelection {
  frame: SceneNode | null
  reason?: string
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

function resolveEmbeddedFrameSelection(store: EditorStore): EmbeddedFrameSelection {
  const selectedIds = [...store.state.selectedIds]
  if (selectedIds.length === 0) {
    return { frame: null, reason: '请选择一个 Frame 或 Frame 内的元素' }
  }

  const frames = selectedIds.map((id) => findNearestFrame(store, id))
  const resolvedFrames = frames.filter((frame): frame is SceneNode => frame !== null)
  if (resolvedFrames.length !== selectedIds.length) {
    return { frame: null, reason: '当前选中对象不在 Frame 内' }
  }

  const uniqueFrames = new Map(resolvedFrames.map((frame) => [frame.id, frame]))
  if (uniqueFrames.size !== 1) {
    return { frame: null, reason: '选中的对象属于不同 Frame' }
  }
  return { frame: uniqueFrames.values().next().value ?? null }
}

export function getEmbeddedFrameBakeState(store: EditorStore): EmbeddedFrameBakeState {
  const revision = store.state.sceneVersion
  const selection = resolveEmbeddedFrameSelection(store)
  if (!selection.frame) {
    return {
      id: '',
      revision,
      available: false,
      name: '',
      width: 0,
      height: 0,
      reason: selection.reason
    }
  }

  return {
    id: selection.frame.id,
    revision,
    available: true,
    name: selection.frame.name,
    width: selection.frame.width,
    height: selection.frame.height
  }
}

export async function bakeEmbeddedFrameById(
  store: EditorStore,
  frameId: string
): Promise<File | null> {
  const node = store.graph.getNode(frameId)
  if (node?.type !== 'FRAME' || node.id === store.graph.rootId) return null

  const data = await renderEmbeddedFramePng(store, node.id)
  const baseName = node.name.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, '_') || 'frame'
  return new File([new Uint8Array(data)], `${baseName}.png`, { type: 'image/png' })
}

export async function bakeEmbeddedFrame(store: EditorStore): Promise<File | null> {
  const selection = resolveEmbeddedFrameSelection(store)
  if (!selection.frame) return null
  return bakeEmbeddedFrameById(store, selection.frame.id)
}
