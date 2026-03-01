import { zipSync, deflateSync } from 'fflate'

import { IS_TAURI } from './constants'
import { initCodec, getCompiledSchema, getSchemaBytes } from './kiwi/codec'
import { sceneNodeToKiwi, fractionalPosition } from './kiwi-serialize'
import { renderThumbnail } from './render-image'

import type { SkiaRenderer } from './renderer'
import type { SceneGraph } from './scene-graph'
import type { NodeChange } from './kiwi/codec'
import type { CanvasKit } from 'canvaskit-wasm'

const THUMBNAIL_1X1 = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
  ),
  (c) => c.charCodeAt(0)
)

type KiwiNodeChange = NodeChange & Record<string, unknown>

function buildFigKiwi(schemaDeflated: Uint8Array, dataCompressed: Uint8Array): Uint8Array {
  const FIG_KIWI_VERSION = 106
  const total = 8 + 4 + 4 + schemaDeflated.length + 4 + dataCompressed.length
  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)

  out.set(new TextEncoder().encode('fig-kiwi'), 0)
  view.setUint32(8, FIG_KIWI_VERSION, true)

  let offset = 12
  view.setUint32(offset, schemaDeflated.length, true)
  offset += 4
  out.set(schemaDeflated, offset)
  offset += schemaDeflated.length

  view.setUint32(offset, dataCompressed.length, true)
  offset += 4
  out.set(dataCompressed, offset)

  return out
}

const THUMBNAIL_WIDTH = 400
const THUMBNAIL_HEIGHT = 225

export async function exportFigFile(
  graph: SceneGraph,
  ck?: CanvasKit,
  renderer?: SkiaRenderer,
  pageId?: string
): Promise<Uint8Array> {
  await initCodec()
  const compiled = getCompiledSchema()
  const schemaDeflated = deflateSync(getSchemaBytes())

  const docGuid = { sessionID: 0, localID: 0 }
  const localIdCounter = { value: 2 }

  const nodeChanges: KiwiNodeChange[] = [
    {
      guid: docGuid,
      type: 'DOCUMENT',
      name: 'Document',
      visible: true,
      opacity: 1,
      phase: 'CREATED',
      transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      strokeWeight: 1,
      strokeAlign: 'CENTER',
      strokeJoin: 'MITER',
      documentColorProfile: 'SRGB'
    }
  ]

  const blobs: Uint8Array[] = []
  const pages = graph.getPages()

  for (let p = 0; p < pages.length; p++) {
    const page = pages[p]
    const canvasLocalID = localIdCounter.value++
    const canvasGuid = { sessionID: 0, localID: canvasLocalID }

    nodeChanges.push({
      guid: canvasGuid,
      parentIndex: { guid: docGuid, position: fractionalPosition(p) },
      type: 'CANVAS',
      name: page.name,
      visible: true,
      opacity: 1,
      phase: 'CREATED',
      transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      strokeWeight: 1,
      strokeAlign: 'CENTER',
      strokeJoin: 'MITER',
      backgroundOpacity: 1,
      backgroundColor: { r: 0.96, g: 0.96, b: 0.96, a: 1 },
      backgroundEnabled: true
    })

    const children = graph.getChildren(page.id)
    for (let i = 0; i < children.length; i++) {
      nodeChanges.push(...sceneNodeToKiwi(children[i], canvasGuid, i, localIdCounter, graph, blobs))
    }
  }

  const msg: Record<string, unknown> = {
    type: 'NODE_CHANGES',
    sessionID: 0,
    ackID: 0,
    nodeChanges
  }

  if (blobs.length > 0) {
    msg.blobs = blobs.map((bytes) => ({ bytes }))
  }

  const kiwiData = compiled.encodeMessage(msg)

  const currentPageId = pageId ?? pages[0]?.id
  const thumbnailPng =
    (ck && renderer && currentPageId
      ? renderThumbnail(ck, renderer, graph, currentPageId, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT)
      : null) ?? THUMBNAIL_1X1

  const metaJson = JSON.stringify({
    version: 1,
    app: 'OpenPencil',
    createdAt: new Date().toISOString()
  })

  if (IS_TAURI) {
    const { invoke } = await import('@tauri-apps/api/core')
    return new Uint8Array(
      await invoke<number[]>('build_fig_file', {
        schemaDeflated: Array.from(schemaDeflated),
        kiwiData: Array.from(kiwiData),
        thumbnailPng: Array.from(thumbnailPng),
        metaJson
      })
    )
  }

  const canvasData = buildFigKiwi(schemaDeflated, deflateSync(kiwiData))
  return zipSync({
    'canvas.fig': [canvasData, { level: 0 }],
    'thumbnail.png': [thumbnailPng, { level: 0 }],
    'meta.json': new TextEncoder().encode(metaJson)
  })
}


