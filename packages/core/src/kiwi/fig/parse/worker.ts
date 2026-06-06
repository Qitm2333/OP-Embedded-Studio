import { importNodeChanges } from '#core/kiwi/fig/import'
import {
  serializeSceneGraph,
  serializedSceneGraphTransferList
} from '#core/kiwi/fig/parse/transfer'

import { parseFigBuffer } from '@open-pencil/kiwi/fig/parse'

interface WorkerParseRequest {
  buffer: ArrayBuffer
  options?: { populate?: 'all' | 'first-page' }
}

type WorkerScope = typeof self & {
  postMessage(message: unknown, transfer: Transferable[]): void
}

self.onmessage = (e: MessageEvent<ArrayBuffer | WorkerParseRequest>) => {
  try {
    const request = e.data instanceof ArrayBuffer ? { buffer: e.data } : e.data
    const { nodeChanges, blobs, images, figKiwiVersion, figSchemaDeflated } = parseFigBuffer(
      request.buffer
    )
    const graph = importNodeChanges(nodeChanges, blobs, new Map(images), request.options)
    graph.figKiwiVersion = figKiwiVersion
    graph.figSchemaDeflated = figSchemaDeflated
    const serialized = serializeSceneGraph(graph)
    ;(self as WorkerScope).postMessage(
      { graph: serialized },
      serializedSceneGraphTransferList(serialized)
    )
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : String(err) })
  }
}
