import { computed, onScopeDispose, shallowRef, triggerRef, type ComputedRef } from 'vue'

import type { Editor } from '@open-pencil/core/editor'

import { useEditor } from '../context'

interface SceneBridge {
  ref: ReturnType<typeof shallowRef<number>>
  count: number
  subscribe: () => void
  unsubscribe: () => void
}

const bridges = new WeakMap<Editor, SceneBridge>()

function getBridge(editor: Editor): SceneBridge {
  let bridge = bridges.get(editor)
  if (bridge) return bridge

  const ref = shallowRef(0)
  const unbinds: Array<() => void> = []

  const trigger = () => {
    ref.value++
    triggerRef(ref)
  }

  bridge = {
    ref,
    count: 0,
    subscribe() {
      if (this.count++ > 0) return
      unbinds.push(
        editor.graph.emitter.on('node:updated', trigger),
        editor.graph.emitter.on('node:created', trigger),
        editor.graph.emitter.on('node:deleted', trigger),
        editor.graph.emitter.on('node:reparented', trigger),
        editor.graph.emitter.on('node:reordered', trigger)
      )
    },
    unsubscribe() {
      if (--this.count > 0) return
      for (const unbind of unbinds) unbind()
      unbinds.length = 0
      bridges.delete(editor)
    }
  }

  bridges.set(editor, bridge)
  return bridge
}

/**
 * Creates a computed ref that re-evaluates when the scene graph changes.
 *
 * Bridges the core editor's nanoevents emitter into Vue's reactivity
 * system via shallowRef + triggerRef. Listeners are ref-counted and
 * cleaned up when the last subscriber's scope is disposed.
 */
export function useSceneComputed<T>(fn: () => T): ComputedRef<T> {
  const editor = useEditor()
  const bridge = getBridge(editor)

  bridge.subscribe()
  onScopeDispose(() => bridge.unsubscribe())

  return computed(() => {
    void bridge.ref.value
    return fn()
  })
}
