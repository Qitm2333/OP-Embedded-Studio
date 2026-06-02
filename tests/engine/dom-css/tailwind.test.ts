import { describe, expect, it } from 'bun:test'

import { compileTailwindCSS, createHeadlessCSSRuntime } from '@open-pencil/dom-css'

describe('@open-pencil/dom-css Tailwind', () => {
  it('compiles utility candidates through Tailwind', async () => {
    const css = await compileTailwindCSS('flex w-80 p-6 rounded-xl bg-white')

    expect(css).toContain('.flex')
    expect(css).toContain('.w-80')
    expect(css).toContain('.p-6')
    expect(css).toContain('--spacing')
  })

  it('feeds Tailwind CSS variables through headless style computation', async () => {
    const runtime = createHeadlessCSSRuntime()
    const css = await compileTailwindCSS(['w-80', 'p-6'])
    const document = await runtime.computeStyles(
      runtime.parseHTML('<section class="w-80 p-6"></section>'),
      css
    )
    const element = document.children[0]

    expect(element?.type).toBe('element')
    if (element?.type !== 'element') return
    expect(element.computedStyle?.width).toBe('320px')
    expect(element.computedStyle?.['padding-top']).toBe('24px')
  })
})
