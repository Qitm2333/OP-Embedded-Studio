import { computed } from 'vue'

import { useEditor } from '../context'

import type { SceneNode } from '@open-pencil/core'

export function useNodeProps() {
  const store = useEditor()
  const node = computed(() => store.getSelectedNode() ?? null)
  const nodes = computed(() => store.getSelectedNodes())

  function updateProp(key: string, value: number | string) {
    if (store.getSelectedNodes().length > 1) {
      storePreviousValues(key)
      for (const n of store.getSelectedNodes()) {
        store.updateNode(n.id, { [key]: value })
      }
    } else {
      const node = store.getSelectedNode()
      if (node) store.updateNode(node.id, { [key]: value })
    }
  }

  const previousValues = new Map<string, Record<string, number | string>>()

  function storePreviousValues(key: string) {
    for (const n of store.getSelectedNodes()) {
      let rec = previousValues.get(n.id)
      if (!rec) {
        rec = {}
        previousValues.set(n.id, rec)
      }
      if (!(key in rec)) {
        rec[key] = n[key as keyof SceneNode] as number | string
      }
    }
  }

  function commitProp(key: string, _value: number | string, previous: number | string) {
    if (store.getSelectedNodes().length > 1) {
      for (const n of store.getSelectedNodes()) {
        const prev = previousValues.get(n.id)?.[key] ?? previous
        store.commitNodeUpdate(n.id, { [key]: prev } as Partial<SceneNode>, `Change ${key}`)
      }
      previousValues.clear()
    } else {
      const node = store.getSelectedNode()
      if (node) {
        store.commitNodeUpdate(node.id, { [key]: previous } as Partial<SceneNode>, `Change ${key}`)
      }
    }
  }

  return { store, node, nodes, updateProp, commitProp }
}
