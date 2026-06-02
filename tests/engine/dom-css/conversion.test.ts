import { describe, expect, it } from 'bun:test'

import {
  designDocumentToSceneGraph,
  sceneGraphToDesignDocument,
  type DesignDocument
} from '@open-pencil/dom-css'

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
