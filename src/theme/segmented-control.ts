import { panelFieldBase } from './panel/field'

const segmentedControlTheme = {
  slots: {
    root: [panelFieldBase, 'inline-flex items-center gap-0.5 p-0.5'],
    item: 'flex h-[22px] min-w-0 flex-1 cursor-pointer items-center justify-center gap-1 rounded-sm text-muted outline-none hover:text-surface focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50'
  },
  variants: {
    size: {
      sm: { item: 'px-1.5 text-[11px]' },
      md: { item: 'px-2 text-xs' }
    },
    selected: {
      true: { item: 'bg-accent text-white hover:text-white' }
    }
  },
  defaultVariants: {
    size: 'sm' as const,
    selected: false as const
  }
}

export type SegmentedControlTheme = typeof segmentedControlTheme
export default segmentedControlTheme
