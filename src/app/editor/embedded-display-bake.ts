import type { EditorStore } from '@/app/editor/session'
import type { EmbeddedFrameBakeState } from '@/features/embedded-display'

import { renderEmbeddedFramePng } from './embedded-frame-render'

export function getEmbeddedFrameBakeState(store: EditorStore): EmbeddedFrameBakeState {
  void store.state.sceneVersion
  const selectedIds = [...store.state.selectedIds]
  if (selectedIds.length !== 1) {
    return {
      available: false,
      name: '',
      width: 0,
      height: 0,
      reason: '请只选中一个 Frame'
    }
  }

  const node = store.graph.getNode(selectedIds[0])
  if (!node || node.type !== 'FRAME') {
    return {
      available: false,
      name: node?.name || '',
      width: node?.width || 0,
      height: node?.height || 0,
      reason: '当前选中对象不是 Frame'
    }
  }

  return {
    available: true,
    name: node.name,
    width: node.width,
    height: node.height
  }
}

export async function bakeEmbeddedFrame(store: EditorStore): Promise<File | null> {
  const selectedIds = [...store.state.selectedIds]
  if (selectedIds.length !== 1) return null
  const node = store.graph.getNode(selectedIds[0])
  if (!node || node.type !== 'FRAME') return null

  const data = await renderEmbeddedFramePng(store, node.id)

  const baseName = node.name.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, '_') || 'frame'
  return new File([data], `${baseName}.png`, { type: 'image/png' })
}
