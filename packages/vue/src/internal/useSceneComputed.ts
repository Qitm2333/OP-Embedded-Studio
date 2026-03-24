import { computed, type ComputedRef } from 'vue'

/**
 * Creates a computed ref that re-evaluates when the scene graph changes.
 *
 * Tracks `state.sceneVersion` — a counter on a shallowReactive object
 * that the core editor increments synchronously on every mutation via
 * requestRender(). Vue tracks the read automatically, so the computed
 * re-evaluates in the same tick as the change. Zero latency.
 */
export function useSceneComputed<T>(fn: () => T, sceneVersion?: () => number): ComputedRef<T> {
  return computed(() => {
    if (sceneVersion) {
      void sceneVersion()
    }
    return fn()
  })
}
