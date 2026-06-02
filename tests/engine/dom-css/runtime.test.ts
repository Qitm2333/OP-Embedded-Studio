import { describe, expect, it } from 'bun:test'

import {
  createCssRuntime,
  createHeadlessCssRuntime,
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
    const runtime = createCssRuntime()

    expect(runtime.kind).toBe('headless')
    expect(runtime.serializeHTML(documentFixture)).toBe(
      '<div class="card" data-id="node-1">OpenPencil</div>'
    )
  })

  it('parses HTML with the headless runtime', () => {
    const runtime = createHeadlessCssRuntime()
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

  it('keeps headless style computation explicit until the CSSOM adapter is added', async () => {
    const runtime = createHeadlessCssRuntime()

    await expect(runtime.computeStyles(documentFixture)).rejects.toThrow('headless CSSOM adapter')
  })
})
