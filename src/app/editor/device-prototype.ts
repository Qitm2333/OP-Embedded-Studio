import type { SceneNode } from '@open-pencil/scene-graph'

import type { EditorStore } from '@/app/editor/session'
import type {
  DevicePrototypeFrameCandidate,
  DevicePrototypeFrameRender,
  DevicePrototypeInteraction
} from '@/features/device-prototype'
import { resolveDevicePrototypeTransitions } from '@/features/device-prototype'
import type { EmbeddedPrototypeBakeResult } from '@/features/embedded-display'

import {
  getEmbeddedFrameBakeState,
  getSelectedEmbeddedVisualSources,
  isEmbeddedVisualSource
} from './embedded-display-bake'
import { renderEmbeddedVisualPng } from './embedded-frame-render'

function candidatesFromNodes(nodes: SceneNode[]): DevicePrototypeFrameCandidate[] {
  const nameCounts = new Map<string, number>()
  for (const node of nodes) {
    const name = node.name.trim() || '未命名画面'
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1)
  }
  const nameIndexes = new Map<string, number>()
  return nodes.map((node) => {
    const baseName = node.name.trim() || '未命名画面'
    const index = (nameIndexes.get(baseName) ?? 0) + 1
    nameIndexes.set(baseName, index)
    return {
      available: true,
      id: node.id,
      sourceKind: node.type === 'FRAME' ? 'frame' : 'image',
      name: (nameCounts.get(baseName) ?? 0) > 1 ? `${baseName} (${index})` : baseName,
      width: node.width,
      height: node.height
    }
  })
}

export function getDevicePrototypeFrameCandidate(
  store: EditorStore
): DevicePrototypeFrameCandidate {
  const source = getEmbeddedFrameBakeState(store)
  return {
    available: source.available,
    id: source.id,
    sourceKind: source.sourceKind,
    name: source.name,
    width: source.width,
    height: source.height,
    reason: source.reason
  }
}

export function getSelectedDevicePrototypeFrameCandidates(
  store: EditorStore
): DevicePrototypeFrameCandidate[] {
  void store.state.sceneVersion
  return candidatesFromNodes(getSelectedEmbeddedVisualSources(store))
}

export function getDevicePrototypeFrameCandidates(
  store: EditorStore
): DevicePrototypeFrameCandidate[] {
  void store.state.sceneVersion
  const nodes = store.graph
    .getChildren(store.state.currentPageId)
    .filter((node) => isEmbeddedVisualSource(node) && node.id !== store.graph.rootId)
  return candidatesFromNodes(nodes)
}

export function createDevicePrototypeFrameRenderer(store: EditorStore): DevicePrototypeFrameRender {
  return async (frameId) => {
    const node = store.graph.getNode(frameId)
    if (!isEmbeddedVisualSource(node)) throw new Error('交互引用的画面已不存在')
    const data = await renderEmbeddedVisualPng(store, node.id)
    return new Blob([Uint8Array.from(data).buffer], { type: 'image/png' })
  }
}

export async function bakeDevicePrototype(
  store: EditorStore,
  interaction: DevicePrototypeInteraction
): Promise<EmbeddedPrototypeBakeResult> {
  const states = []
  for (const state of interaction.states) {
    const node = store.graph.getNode(state.frameId)
    if (!isEmbeddedVisualSource(node)) throw new Error(`交互引用的画面已不存在：${state.name}`)
    const data = await renderEmbeddedVisualPng(store, node.id)
    states.push({
      id: state.id,
      name: state.name,
      file: new File([Uint8Array.from(data).buffer], `${state.name || 'state'}.png`, {
        type: 'image/png'
      })
    })
  }

  return {
    id: interaction.id,
    name: interaction.name,
    mode: interaction.mode,
    intervalMs: interaction.slideshow.intervalMs,
    initialStateId: interaction.initialStateId,
    states,
    transitions: resolveDevicePrototypeTransitions(interaction).map((transition) => ({
      ...transition
    }))
  }
}
