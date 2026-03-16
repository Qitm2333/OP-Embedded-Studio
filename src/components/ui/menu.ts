import { twMerge } from 'tailwind-merge'
import { tv } from 'tailwind-variants'

const content = tv({
  base: 'z-50 rounded-lg border border-border bg-panel p-1 shadow-lg'
})

const item = tv({
  base: 'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none select-none data-[disabled]:cursor-default data-[disabled]:text-muted/50 data-[highlighted]:bg-hover',
  variants: {
    tone: {
      default: 'text-surface',
      component:
        'text-component data-[disabled]:text-component/40 data-[highlighted]:bg-component/12'
    },
    justify: {
      between: 'justify-between gap-6',
      start: 'justify-start'
    }
  },
  defaultVariants: {
    tone: 'default',
    justify: 'between'
  }
})

const separator = tv({
  base: 'mx-1 my-1 h-px bg-border'
})

export function menuContent(options?: { class?: string }) {
  return twMerge(content(), options?.class)
}

export function menuItem(options?: {
  tone?: 'default' | 'component'
  justify?: 'between' | 'start'
  class?: string
}) {
  return twMerge(item(options), options?.class)
}

export function menuSeparator(options?: { class?: string }) {
  return twMerge(separator(), options?.class)
}
