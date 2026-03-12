import { zipSync, type Zippable } from 'fflate'
import { buildFigKiwi } from './kiwi-serialize'

interface CompressMessage {
  schemaDeflated: Uint8Array
  kiwiData: Uint8Array
  thumbnailPng: Uint8Array
  metaJson: string
  images: Array<{ name: string; data: Uint8Array }>
}

self.onmessage = (e: MessageEvent<CompressMessage>) => {
  const { schemaDeflated, kiwiData, thumbnailPng, metaJson, images } = e.data

  const canvasData = buildFigKiwi(schemaDeflated, kiwiData)

  const zipEntries: Zippable = {
    'canvas.fig': [canvasData, { level: 0 }],
    'thumbnail.png': [thumbnailPng, { level: 0 }],
    'meta.json': new TextEncoder().encode(metaJson)
  }
  for (const entry of images) {
    zipEntries[entry.name] = [entry.data, { level: 0 }]
  }

  const result = zipSync(zipEntries)
  self.postMessage(result, { transfer: [result.buffer] })
}
