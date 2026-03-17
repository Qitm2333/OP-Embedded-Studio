import { computed, type ComputedRef } from 'vue'

import { useEditor } from '../context'

/**
 * Creates a computed ref that re-evaluates when the scene graph changes.
 * Replaces the `void editor.state.sceneVersion` reactivity hack.
 */
export function useSceneComputed<T>(fn: () => T): ComputedRef<T> {
  const editor = useEditor()
  return computed(() => {
    void editor.state.sceneVersion
    return fn()
  })
}
