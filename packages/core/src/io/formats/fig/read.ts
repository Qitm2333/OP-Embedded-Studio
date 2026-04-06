import { IS_BROWSER } from '../../../constants'
import { importNodeChanges } from '../../../kiwi/fig-import'
import { parseFigBuffer } from '../../../kiwi/fig-parse-core'

import type { FigParseResult } from '../../../kiwi/fig-parse-core'
import type { SceneGraph } from '../../../scene-graph'

function parseFigFileSync(buffer: ArrayBuffer): SceneGraph {
  const { nodeChanges, blobs, images: imageEntries, figKiwiVersion } = parseFigBuffer(buffer)
  const graph = importNodeChanges(nodeChanges, blobs, new Map(imageEntries))
  graph.figKiwiVersion = figKiwiVersion
  return graph
}

function parseViaWorker(buffer: ArrayBuffer): Promise<SceneGraph> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../../../kiwi/fig-parse-worker.ts', import.meta.url), {
      type: 'module'
    })

    worker.onmessage = (e: MessageEvent<FigParseResult & { error?: string }>) => {
      worker.terminate()
      if (e.data.error) {
        reject(new Error(e.data.error))
        return
      }
      const { nodeChanges, blobs, images: imageEntries, figKiwiVersion } = e.data
      const images = new Map<string, Uint8Array>(imageEntries)
      const graph = importNodeChanges(nodeChanges, blobs, images)
      graph.figKiwiVersion = figKiwiVersion
      resolve(graph)
    }

    worker.onerror = (err) => {
      worker.terminate()
      reject(new Error(err.message || 'Worker failed to parse .fig file'))
    }

    worker.postMessage(buffer, [buffer])
  })
}

export async function parseFigFile(buffer: ArrayBuffer): Promise<SceneGraph> {
  if (typeof Worker !== 'undefined' && IS_BROWSER) {
    const copy = buffer.slice(0)
    try {
      return await parseViaWorker(buffer)
    } catch (error) {
      console.warn('Worker parsing failed, falling back to main thread:', error)
      return parseFigFileSync(copy)
    }
  }
  return parseFigFileSync(buffer)
}

export async function readFigFile(file: File): Promise<SceneGraph> {
  return parseFigFile(await file.arrayBuffer())
}
