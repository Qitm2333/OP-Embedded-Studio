import { defineCommand } from 'citty'

import { loadDocument } from '../headless'
import { bold, fmtList, entity, formatType } from '../format'

export default defineCommand({
  meta: { description: 'List pages in a .fig file' },
  args: {
    file: { type: 'positional', description: '.fig file path', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const graph = await loadDocument(args.file)
    const pages = graph.getPages()

    const countNodes = (pageId: string): number => {
      let count = 0
      const walk = (id: string) => {
        count++
        const n = graph.getNode(id)
        if (n) for (const cid of n.childIds) walk(cid)
      }
      const page = graph.getNode(pageId)
      if (page) for (const cid of page.childIds) walk(cid)
      return count
    }

    if (args.json) {
      console.log(
        JSON.stringify(
          pages.map((p) => ({ id: p.id, name: p.name, nodes: countNodes(p.id) })),
          null,
          2
        )
      )
      return
    }

    console.log('')
    console.log(bold(`  ${pages.length} page${pages.length !== 1 ? 's' : ''}`))
    console.log('')
    console.log(
      fmtList(
        pages.map((page) => ({
          header: entity(formatType(page.type), page.name, page.id),
          details: { nodes: countNodes(page.id) }
        })),
        { compact: true }
      )
    )
    console.log('')
  }
})
