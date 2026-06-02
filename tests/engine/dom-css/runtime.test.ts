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

  it('keeps headless HTML parsing explicit until the parser adapter is added', () => {
    const runtime = createHeadlessCssRuntime()

    expect(() => runtime.parseHTML('<div />')).toThrow('headless DOM/CSS adapter')
  })
})
