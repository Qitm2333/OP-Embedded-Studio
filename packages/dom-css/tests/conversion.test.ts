import { describe, expect, it } from 'bun:test'

import {
  createHeadlessCSSRuntime,
  designDocumentToSceneGraph,
  htmlToDesignDocument,
  htmlToSceneGraph,
  sceneGraphToDesignDocument,
  serializeHTML
} from '../src/index'
import { cardCSS, cardHTML, fixtureCSS, fixtureHTML } from './helpers'

describe('@open-pencil/dom-css conversion', () => {
  it('converts HTML and CSS to DesignDOM with one API call', async () => {
    const document = await htmlToDesignDocument(cardHTML, {
      cssText: cardCSS,
      runtime: createHeadlessCSSRuntime()
    })
    const card = document.children[0]

    expect(card?.type).toBe('element')
    if (card?.type !== 'element') return
    expect(card.computedStyle?.width).toBe('320px')
    expect(card.computedStyle?.['border-radius']).toBe('16px')
  })

  it('converts HTML and CSS to a scene graph with one API call', async () => {
    const graph = await htmlToSceneGraph(cardHTML, {
      cssText: cardCSS,
      runtime: createHeadlessCSSRuntime()
    })
    const page = graph.getPages()[0]
    const card = page ? graph.getChildren(page.id)[0] : undefined

    expect(card?.type).toBe('FRAME')
    if (card?.type !== 'FRAME') return
    expect(card.width).toBe(320)
    expect(card.height).toBe(180)
    expect(card.layoutMode).toBe('VERTICAL')
    expect(card.itemSpacing).toBe(12)
    expect(card.paddingLeft).toBe(24)
    expect(card.cornerRadius).toBe(16)
    expect(card.effects[0]?.type).toBe('DROP_SHADOW')
  })

  it('keeps box-like inline controls as editable frames', async () => {
    const graph = await htmlToSceneGraph(fixtureHTML, {
      cssText: fixtureCSS,
      runtime: createHeadlessCSSRuntime()
    })
    const page = graph.getPages()[0]
    const shell = page ? graph.getChildren(page.id)[0] : undefined
    expect(shell?.type).toBe('FRAME')
    if (shell?.type !== 'FRAME') return

    const [navbar, input] = graph.getChildren(shell.id)
    expect(navbar?.type).toBe('FRAME')
    expect(input?.type).toBe('FRAME')
    if (navbar?.type !== 'FRAME' || input?.type !== 'FRAME') return
    expect(navbar.primaryAxisAlign).toBe('SPACE_BETWEEN')
    expect(input.width).toBe(312)
    expect(input.paddingLeft).toBe(12)

    const badge = graph.getChildren(navbar.id)[1]
    expect(badge?.type).toBe('FRAME')
    if (badge?.type !== 'FRAME') return
    expect(badge.cornerRadius).toBe(9999)
    expect(graph.getChildren(badge.id)[0]?.type).toBe('TEXT')
  })

  it('projects scene graph output back into DesignDOM HTML', async () => {
    const graph = await htmlToSceneGraph(cardHTML, {
      cssText: cardCSS,
      runtime: createHeadlessCSSRuntime()
    })
    const document = sceneGraphToDesignDocument(graph)
    const html = serializeHTML(document)

    expect(html).toContain('OpenPencil')
    expect(html).toContain('box-shadow')
  })

  it('projects a manually built DesignDOM document into a scene graph', async () => {
    const runtime = createHeadlessCSSRuntime()
    const document = await runtime.computeStyles(runtime.parseHTML(cardHTML), cardCSS)
    const graph = designDocumentToSceneGraph(document)
    const page = graph.getPages()[0]
    const card = page ? graph.getChildren(page.id)[0] : undefined

    expect(card?.type).toBe('FRAME')
    if (card?.type !== 'FRAME') return
    expect(card.fills[0]?.type).toBe('SOLID')
    expect(card.strokes[0]?.weight).toBe(1)
  })
})
