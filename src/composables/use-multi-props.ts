import { computed } from 'vue'

import { useEditorStore } from '@/stores/editor'

import type { SceneNode } from '@/engine/scene-graph'

export const MIXED = Symbol('mixed')
export type MixedValue<T> = T | typeof MIXED

export function useMultiProps() {
  const store = useEditorStore()
  const node = computed(() => store.selectedNode.value ?? null)
  const nodes = computed(() => store.selectedNodes.value)
  const isMulti = computed(() => nodes.value.length > 1)
  const active = computed(() => node.value || isMulti.value)
  const activeNode = computed(() => node.value ?? nodes.value[0] ?? null)

  function merged<K extends keyof SceneNode>(key: K): MixedValue<SceneNode[K]> {
    const all = nodes.value
    if (all.length === 0) return MIXED
    const first = all[0][key]
    for (let i = 1; i < all.length; i++) {
      if (all[i][key] !== first) return MIXED
    }
    return first
  }

  function prop<K extends keyof SceneNode>(key: K) {
    return computed(() => merged(key))
  }

  function updateAllWithUndo(patch: Partial<SceneNode>, label: string) {
    for (const n of nodes.value) {
      store.updateNodeWithUndo(n.id, patch, label)
    }
    store.requestRender()
  }

  return { store, node, nodes, isMulti, active, activeNode, prop, merged, updateAllWithUndo }
}
