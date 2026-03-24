import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import { useComponentUI } from '@/components/ui/use-component-ui'

const iconButtonStyles = tv({
  base: 'flex cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface',
  variants: {
    size: {
      sm: 'size-5 text-sm leading-none',
      md: 'size-7 border border-border bg-input'
    }
  },
  defaultVariants: { size: 'sm' }
})

export function iconButton(options?: {
  size?: 'sm' | 'md'
  ui?: {
    base?: string
  }
}) {
  const ui = useComponentUI(options?.ui, { base: '' })
  const classes = computed(() => iconButtonStyles({ size: options?.size, class: ui.value.base }))
  return classes.value
}
