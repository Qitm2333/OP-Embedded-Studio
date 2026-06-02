import { colorToCSS } from '@open-pencil/core/color'
import type { DesignDocument } from '@open-pencil/dom-css'

export const DOM_CSS_COLORS = {
  slate900: colorToCSS({ r: 17 / 255, g: 24 / 255, b: 39 / 255, a: 1 }),
  slate700: colorToCSS({ r: 31 / 255, g: 41 / 255, b: 55 / 255, a: 1 }),
  slate200: colorToCSS({ r: 229 / 255, g: 231 / 255, b: 235 / 255, a: 1 }),
  slateShadow: colorToCSS({ r: 15 / 255, g: 23 / 255, b: 42 / 255, a: 0.12 })
} as const

export const simpleCardDocument: DesignDocument = {
  type: 'document',
  children: [
    {
      type: 'element',
      tagName: 'div',
      attrs: { class: 'card', 'data-id': 'node-1' },
      children: [{ type: 'text', text: 'OpenPencil' }]
    }
  ]
}

export const cssCardHTML = `
  <article class="card">
    <h1 class="title">OpenPencil</h1>
    <p class="description">Design with code-shaped CSS.</p>
  </article>
`

export const cssCardCSS = `
  .card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 24px;
    width: 320px;
    height: 180px;
    border: 1px solid ${DOM_CSS_COLORS.slate200};
    border-radius: 16px;
    background: white;
    box-shadow: 0px 8px 24px 0px ${DOM_CSS_COLORS.slateShadow};
    color: ${DOM_CSS_COLORS.slate900};
  }
  .card .title {
    font-size: 24px;
    font-weight: 700;
    line-height: 32px;
  }
  .description {
    font-size: 14px;
    line-height: 20px;
  }
`

export const computedCardDocument: DesignDocument = {
  type: 'document',
  children: [
    {
      type: 'element',
      tagName: 'div',
      attrs: { class: 'card' },
      computedStyle: {
        width: '320px',
        height: '160px',
        display: 'flex',
        'flex-direction': 'column',
        gap: '12px',
        padding: '24px',
        'border-radius': '16px',
        'background-color': 'rgb(255, 255, 255)'
      },
      children: [
        {
          type: 'element',
          tagName: 'h1',
          attrs: {},
          computedStyle: {
            color: 'rgb(17, 24, 39)',
            'font-size': '24px',
            'font-weight': '700',
            'line-height': '32px'
          },
          children: [{ type: 'text', text: 'OpenPencil' }]
        }
      ]
    }
  ]
}

export const tailwindCardClasses = [
  'flex',
  'flex-col',
  'gap-3',
  'w-80',
  'h-44',
  'p-6',
  'rounded-xl',
  'bg-white',
  'text-slate-900'
] as const

export const tailwindButtonClasses = [
  'inline-flex',
  'items-center',
  'justify-center',
  'gap-2',
  'rounded-md',
  'bg-slate-900',
  'px-4',
  'py-2',
  'text-sm',
  'font-medium',
  'text-white'
] as const
