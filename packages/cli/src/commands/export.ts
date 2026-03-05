import { defineCommand } from 'citty'
import { basename, extname, resolve } from 'node:path'

import { renderNodesToSVG } from '@open-pencil/core'

import { loadDocument, loadFonts, exportNodes, exportThumbnail } from '../headless'
import { ok, printError } from '../format'
import type { ExportFormat } from '@open-pencil/core'

const RASTER_FORMATS = ['PNG', 'JPG', 'WEBP']

export default defineCommand({
  meta: { description: 'Export a .fig file to PNG, JPG, WEBP, or SVG' },
  args: {
    file: { type: 'positional', description: '.fig file path', required: true },
    output: { type: 'string', alias: 'o', description: 'Output file path (default: <name>.<format>)' },
    format: { type: 'string', alias: 'f', description: 'Export format: png, jpg, webp, svg (default: png)', default: 'png' },
    scale: { type: 'string', alias: 's', description: 'Export scale (default: 1)', default: '1' },
    quality: { type: 'string', alias: 'q', description: 'Quality 0-100 for JPG/WEBP (default: 90)' },
    page: { type: 'string', description: 'Page name (default: first page)' },
    node: { type: 'string', description: 'Node ID to export (default: all top-level nodes)' },
    thumbnail: { type: 'boolean', description: 'Export page thumbnail instead of full render' },
    width: { type: 'string', description: 'Thumbnail width (default: 1920)', default: '1920' },
    height: { type: 'string', description: 'Thumbnail height (default: 1080)', default: '1080' }
  },
  async run({ args }) {
    const format = args.format.toUpperCase() as ExportFormat
    if (![...RASTER_FORMATS, 'SVG'].includes(format)) {
      printError(`Invalid format "${args.format}". Use png, jpg, webp, or svg.`)
      process.exit(1)
    }

    const graph = await loadDocument(args.file)
    await loadFonts(graph)

    const pages = graph.getPages()
    const page = args.page
      ? pages.find((p) => p.name === args.page)
      : pages[0]

    if (!page) {
      printError(`Page "${args.page}" not found.`)
      process.exit(1)
    }

    const ext = format.toLowerCase() === 'jpg' ? 'jpg' : format.toLowerCase()
    const defaultName = basename(args.file, extname(args.file))
    const output = resolve(args.output ?? `${defaultName}.${ext}`)

    if (format === 'SVG') {
      const nodeIds = args.node ? [args.node] : page.childIds
      const svgStr = renderNodesToSVG(graph, page.id, nodeIds)
      if (!svgStr) {
        printError('Nothing to export (empty page or no visible nodes).')
        process.exit(1)
      }
      await Bun.write(output, svgStr)
      console.log(ok(`Exported ${output} (${(svgStr.length / 1024).toFixed(1)} KB)`))
      return
    }

    let data: Uint8Array | null

    if (args.thumbnail) {
      data = await exportThumbnail(graph, page.id, Number(args.width), Number(args.height))
    } else {
      const nodeIds = args.node ? [args.node] : page.childIds
      data = await exportNodes(graph, page.id, nodeIds, {
        scale: Number(args.scale),
        format,
        quality: args.quality ? Number(args.quality) : undefined
      })
    }

    if (!data) {
      printError('Nothing to export (empty page or no visible nodes).')
      process.exit(1)
    }

    await Bun.write(output, data)
    console.log(ok(`Exported ${output} (${(data.length / 1024).toFixed(1)} KB)`))
  }
})
