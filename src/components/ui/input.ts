import { twMerge } from 'tailwind-merge'
import { tv } from 'tailwind-variants'

import { useComponentUI } from '@/components/ui/use-component-ui'

const input = tv({
  base: 'w-full rounded border border-border bg-input text-surface outline-none focus:border-accent',
  variants: {
    size: {
      sm: 'px-2 py-1 text-[11px]',
      md: 'px-2 py-1 text-xs'
    }
  },
  defaultVariants: {
    size: 'md'
  }
})

export function uiInput(options?: {
  size?: 'sm' | 'md'
  ui?: {
    base?: string
  }
}) {
  const ui = useComponentUI(options?.ui, { base: '' })
  return twMerge(input(options), ui.value.base)
}
