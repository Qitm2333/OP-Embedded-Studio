import { computed, type ComputedRef } from 'vue'

/**
 * Convenience wrapper for scene-derived computed state.
 *
 * Use this for values that should clearly read as editor/scene-backed derived
 * state in higher-level composables.
 */
export function useSceneComputed<T>(fn: () => T): ComputedRef<T> {
  return computed(fn)
}
