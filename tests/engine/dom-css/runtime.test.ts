import { describe, expect, it } from 'bun:test'

import {
  createCSSRuntime,
  createHeadlessCSSRuntime,
  serializeHTML,
  type DesignDocument
} from '@open-pencil/dom-css'

const documentFixture: DesignDocument = {
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

describe('@open-pencil/dom-css', () => {
  it('serializes DesignDOM as HTML', () => {
    expect(serializeHTML(documentFixture)).toBe(
      '<div class="card" data-id="node-1">OpenPencil</div>'
    )
  })

  it('uses the headless runtime outside browser contexts', () => {
    const runtime = createCSSRuntime()

    expect(runtime.kind).toBe('headless')
    expect(runtime.serializeHTML(documentFixture)).toBe(
      '<div class="card" data-id="node-1">OpenPencil</div>'
    )
  })

  it('parses HTML with the headless runtime', () => {
    const runtime = createHeadlessCSSRuntime()
    const document = runtime.parseHTML(
      '<section class="card" style="width: 320px; color: rgb(17, 24, 39)">OpenPencil</section>'
    )
    const section = document.children[0]

    expect(section?.type).toBe('element')
    if (section?.type !== 'element') return
    expect(section.tagName).toBe('section')
    expect(section.attrs.class).toBe('card')
    expect(section.inlineStyle?.width).toBe('320px')
    expect(section.inlineStyle?.color).toBe('rgb(17, 24, 39)')
    expect(section.children[0]).toEqual({ type: 'text', text: 'OpenPencil' })
  })

  it('computes simple headless styles from CSSOM rules', async () => {
    const runtime = createHeadlessCSSRuntime()
    const document = await runtime.computeStyles(
      documentFixture,
      '.card { width: 320px; color: rgb(17, 24, 39); } #missing { color: red; }'
    )
    const card = document.children[0]

    expect(card?.type).toBe('element')
    if (card?.type !== 'element') return
    expect(card.computedStyle?.width).toBe('320px')
    expect(card.computedStyle?.color).toBe('rgb(17, 24, 39)')
  })
})
