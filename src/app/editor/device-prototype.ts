import type { EditorStore } from '@/app/editor/session'
import type {
  DevicePrototypeFrameCandidate,
  DevicePrototypeFrameRender,
  DevicePrototypeInteraction
} from '@/features/device-prototype'
import type { EmbeddedPrototypeBakeResult } from '@/features/embedded-display'

import { renderEmbeddedFramePng } from './embedded-frame-render'

export function getDevicePrototypeFrameCandidate(
  store: EditorStore
): DevicePrototypeFrameCandidate {
  void store.state.sceneVersion
  const selectedIds = [...store.state.selectedIds]
  if (selectedIds.length === 0) {
    return {
      available: false,
      id: '',
      name: '',
      width: 0,
      height: 0,
      reason: '请选择一个 Frame 或 Frame 内的元素'
    }
  }

  const pageIds = new Set(store.graph.getPages().map((page) => page.id))
  const frames = selectedIds.flatMap((selectedId) => {
    let node = store.graph.getNode(selectedId)
    while (node) {
      if (
        node.type === 'FRAME' &&
        node.id !== store.graph.rootId &&
        !pageIds.has(node.id)
      ) {
        return [node]
      }
      if (!node.parentId) break
      node = store.graph.getNode(node.parentId)
    }
    return []
  })
  const uniqueFrames = [...new Map(frames.map((frame) => [frame.id, frame])).values()]

  if (uniqueFrames.length !== 1 || frames.length !== selectedIds.length) {
    return {
      available: false,
      id: '',
      name: '',
      width: 0,
      height: 0,
      reason:
        uniqueFrames.length > 1
          ? '选中的对象属于不同 Frame'
          : '当前选中对象不在 Frame 内'
    }
  }

  const frame = uniqueFrames[0]
  return {
    available: true,
    id: frame.id,
    name: frame.name,
    width: frame.width,
    height: frame.height
  }
}
export function createDevicePrototypeFrameRenderer(store: EditorStore): DevicePrototypeFrameRender {
  return async (frameId) => {
    const node = store.graph.getNode(frameId)
    if (!node || node.type !== 'FRAME') throw new Error('交互引用的 Frame 已不存在')
    const data = await renderEmbeddedFramePng(store, node.id)
    return new Blob([data], { type: 'image/png' })
  }
}

export async function bakeDevicePrototype(
  store: EditorStore,
  interaction: DevicePrototypeInteraction
): Promise<EmbeddedPrototypeBakeResult> {
  const states = []
  for (const state of interaction.states) {
    const node = store.graph.getNode(state.frameId)
    if (!node || node.type !== 'FRAME') throw new Error(`交互引用的 Frame 已不存在：${state.name}`)
    const data = await renderEmbeddedFramePng(store, node.id)
    states.push({
      id: state.id,
      name: state.name,
      file: new File([data], `${state.name || 'state'}.png`, { type: 'image/png' })
    })
  }

  return {
    id: interaction.id,
    name: interaction.name,
    initialStateId: interaction.initialStateId,
    states,
    transitions: interaction.transitions.map((transition) => ({ ...transition }))
  }
}
