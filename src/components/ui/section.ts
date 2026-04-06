import { tv } from 'tailwind-variants'

const section = tv({
  slots: {
    wrapper: 'border-b border-border px-3 py-2',
    label: 'mb-1 block text-[11px] text-muted'
  }
})

interface SectionUi {
  wrapper?: string
  label?: string
}

export function useSectionUI(ui?: SectionUi) {
  const cls = section()
  return {
    wrapper: cls.wrapper({ class: ui?.wrapper }),
    label: cls.label({ class: ui?.label })
  }
}
