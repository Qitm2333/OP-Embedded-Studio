import { useBreakpoints } from '@vueuse/core'
import { computed } from 'vue'

const breakpoints = useBreakpoints({ mobile: 768 })

export function useViewportKind() {
  const isMobile = breakpoints.smaller('mobile')
  const isDesktop = computed(() => !isMobile.value)

  return {
    isMobile,
    isDesktop
  }
}
