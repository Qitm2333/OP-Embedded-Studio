import { computed } from 'vue'

export function useComponentUI<T extends object>(ui: Partial<T> | undefined, defaults: T) {
  return computed(() => ({ ...defaults, ...ui }))
}
