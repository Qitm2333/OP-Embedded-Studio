import {
  compileTailwindCSS,
  createHeadlessCSSRuntime,
  htmlToSceneGraph,
  serializeHTML,
  type DesignDocument
} from '../dist/index.js'

const document: DesignDocument = {
  type: 'document',
  children: [
    {
      type: 'element',
      tagName: 'article',
      attrs: { class: 'card' },
      children: [{ type: 'text', text: 'OpenPencil' }]
    }
  ]
}

const html = serializeHTML(document)
if (!html.includes('OpenPencil')) {
  throw new Error('Expected built serializeHTML() to emit document text')
}

const css = await compileTailwindCSS(['flex', 'w-80'])
if (!css.includes('.w-80')) {
  throw new Error('Expected built compileTailwindCSS() to emit Tailwind utility CSS')
}

const graph = await htmlToSceneGraph('<article class="card">OpenPencil</article>', {
  cssText: '.card { display: flex; width: 320px; }',
  runtime: createHeadlessCSSRuntime()
})
const page = graph.getPages()[0]
const card = page ? graph.getChildren(page.id)[0] : undefined
if (card?.type !== 'FRAME' || card.width !== 320) {
  throw new Error('Expected built htmlToSceneGraph() to produce a sized frame')
}
