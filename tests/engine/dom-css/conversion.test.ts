import { describe, expect, it } from 'bun:test'

import { colorToCSS } from '@open-pencil/core/color'
import {
  createHeadlessCSSRuntime,
  designDocumentToSceneGraph,
  sceneGraphToDesignDocument,
  serializeHTML,
  type DesignDocument
} from '@open-pencil/dom-css'

const slate900 = colorToCSS({ r: 17 / 255, g: 24 / 255, b: 39 / 255, a: 1 })
const slateShadow = colorToCSS({ r: 15 / 255, g: 23 / 255, b: 42 / 255, a: 0.12 })
const slate200 = colorToCSS({ r: 229 / 255, g: 231 / 255, b: 235 / 255, a: 1 })

const cardHTML = `
  <article class="card">
    <h1 class="title">OpenPencil</h1>
    <p class="description">Design with code-shaped CSS.</p>
  </article>
`

const cardCSS = `
  .card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 24px;
    width: 320px;
    height: 180px;
    border: 1px solid ${slate200};
    border-radius: 16px;
    background: white;
    box-shadow: 0px 8px 24px 0px ${slateShadow};
    color: ${slate900};
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

const cardDocument: DesignDocument = {
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

describe('@open-pencil/dom-css conversion', () => {
  it('projects a DesignDOM card into a scene graph', () => {
    const graph = designDocumentToSceneGraph(cardDocument)
    const page = graph.getPages()[0]
    expect(page?.name).toBe('DesignDOM')

    const card = page ? graph.getChildren(page.id)[0] : undefined
    expect(card?.type).toBe('FRAME')
    expect(card?.width).toBe(320)
    expect(card?.height).toBe(160)
    expect(card?.layoutMode).toBe('VERTICAL')
    expect(card?.itemSpacing).toBe(12)
    expect(card?.paddingTop).toBe(24)
    expect(card?.cornerRadius).toBe(16)
    expect(card?.fills[0]?.type).toBe('SOLID')

    const title = card ? graph.getChildren(card.id)[0] : undefined
    expect(title?.type).toBe('TEXT')
    expect(title?.text).toBe('OpenPencil')
    expect(title?.fontSize).toBe(24)
    expect(title?.fontWeight).toBe(700)
  })

  it('projects a parsed and styled HTML/CSS card into a scene graph', async () => {
    const runtime = createHeadlessCSSRuntime()
    const document = await runtime.computeStyles(runtime.parseHTML(cardHTML), cardCSS)
    const graph = designDocumentToSceneGraph(document)
    const page = graph.getPages()[0]
    const card = page ? graph.getChildren(page.id)[0] : undefined

    expect(card?.type).toBe('FRAME')
    if (card?.type !== 'FRAME') return
    expect(card.width).toBe(320)
    expect(card.height).toBe(180)
    expect(card.layoutMode).toBe('VERTICAL')
    expect(card.itemSpacing).toBe(12)
    expect(card.paddingLeft).toBe(24)
    expect(card.fills[0]?.type).toBe('SOLID')
    expect(card.strokes[0]?.weight).toBe(1)
    expect(card.effects[0]?.type).toBe('DROP_SHADOW')
    expect(card.effects[0]?.radius).toBe(24)

    const [title, description] = graph.getChildren(card.id)
    expect(title?.type).toBe('TEXT')
    expect(title?.fontSize).toBe(24)
    expect(title?.fills[0]?.type).toBe('SOLID')
    expect(description?.type).toBe('TEXT')
    expect(description?.fontSize).toBe(14)

    const roundTrip = sceneGraphToDesignDocument(graph)
    const html = serializeHTML(roundTrip)
    expect(html).toContain('OpenPencil')
    expect(html).toContain('Design with code-shaped CSS.')
    expect(html).toContain('box-shadow')
  })

  it('projects a scene graph back into DesignDOM', () => {
    const graph = designDocumentToSceneGraph(cardDocument)
    const document = sceneGraphToDesignDocument(graph)
    const page = document.children[0]
    expect(page?.type).toBe('element')
    if (page?.type !== 'element') return

    const card = page.children[0]
    expect(card?.type).toBe('element')
    if (card?.type !== 'element') return

    expect(card.tagName).toBe('div')
    expect(card.inlineStyle?.width).toBe('320px')
    expect(card.inlineStyle?.display).toBe('flex')
    expect(card.inlineStyle?.['flex-direction']).toBe('column')
    expect(card.attrs['data-open-pencil-node-id']).toBeTruthy()

    const title = card.children[0]
    expect(title?.type).toBe('element')
    if (title?.type !== 'element') return
    expect(title.tagName).toBe('span')
    expect(title.inlineStyle?.['font-size']).toBe('24px')
  })
})
