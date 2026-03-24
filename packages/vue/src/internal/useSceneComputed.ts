import { computed, type ComputedRef } from 'vue'

export function useSceneComputed<T>(fn: () => T): ComputedRef<T> {
  return computed(fn)
}
