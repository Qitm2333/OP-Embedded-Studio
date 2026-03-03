import { inflateSync, deflateSync } from 'fflate'

import {
  sceneNodeToKiwi,
  buildFigKiwi,
  parseFigKiwiChunks,
  decompressFigKiwiDataAsync
} from './kiwi-serialize'
import { initCodec, getCompiledSchema, getSchemaBytes } from './kiwi/codec'
import { decodeBinarySchema, compileSchema, ByteBuffer } from './kiwi/kiwi-schema'
import { nodeChangeToProps } from './kiwi/kiwi-convert'

import type { NodeChange as KiwiNodeChange } from './kiwi/codec'
import type { SceneGraph, SceneNode } from './scene-graph'

interface FigmaClipboardMeta {
  fileKey: string
  pasteID: number
  dataType: string
}

export async function prefetchFigmaSchema(): Promise<void> {
  await initCodec()
}

function binaryToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToBinary(b64: string): Uint8Array {
  const raw = atob(b64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i)
  }
  return bytes
}

// --- Paste from Figma ---

export async function parseFigmaClipboard(
  html: string
): Promise<{ nodes: KiwiNodeChange[]; meta: FigmaClipboardMeta; blobs: Uint8Array[] } | null> {
  const metaMatch = html.match(/\(figmeta\)(.*?)\(\/figmeta\)/)
  const bufMatch = html.match(/\(figma\)(.*?)\(\/figma\)/s)
  if (!metaMatch || !bufMatch) return null

  const meta: FigmaClipboardMeta = JSON.parse(atob(metaMatch[1]))
  const binary = base64ToBinary(bufMatch[1])

  const chunks = parseFigKiwiChunks(binary)
  if (!chunks) return null

  const schemaBytes = inflateSync(chunks[0])
  const schema = decodeBinarySchema(new ByteBuffer(schemaBytes))
  const compiled = compileSchema(schema)
  const dataRaw = await decompressFigKiwiDataAsync(chunks[1])
  const msg = compiled.decodeMessage(dataRaw) as {
    nodeChanges?: KiwiNodeChange[]
    blobs?: Array<{ bytes: Uint8Array | Record<string, number> }>
  }

  const blobs: Uint8Array[] = (msg.blobs ?? []).map((b) =>
    b.bytes instanceof Uint8Array ? b.bytes : new Uint8Array(Object.values(b.bytes) as number[])
  )

  return { nodes: msg.nodeChanges ?? [], meta, blobs }
}

const NON_VISUAL_TYPES = new Set([
  'DOCUMENT',
  'CANVAS',
  'VARIABLE_SET',
  'VARIABLE',
  'VARIABLE_COLLECTION',
  'STYLE',
  'STYLE_SET',
  'INTERNAL_ONLY_NODE',
  'WIDGET',
  'STAMP',
  'STICKY',
  'SHAPE_WITH_TEXT',
  'CONNECTOR',
  'CODE_BLOCK',
  'TABLE_NODE',
  'TABLE_CELL',
  'SECTION_OVERLAY',
  'SLIDE'
])

export function figmaNodesBounds(
  nodeChanges: KiwiNodeChange[]
): { x: number; y: number; w: number; h: number } | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  const parentTypes = new Map<string, string>()
  for (const nc of nodeChanges) {
    if (!nc.guid) continue
    const id = `${nc.guid.sessionID}:${nc.guid.localID}`
    parentTypes.set(id, nc.type ?? '')
  }

  for (const nc of nodeChanges) {
    if (!nc.guid || !nc.type || NON_VISUAL_TYPES.has(nc.type)) continue
    const parentId = nc.parentIndex?.guid
      ? `${nc.parentIndex.guid.sessionID}:${nc.parentIndex.guid.localID}`
      : null
    if (parentId && parentTypes.has(parentId) && !NON_VISUAL_TYPES.has(parentTypes.get(parentId)!))
      continue

    const x = nc.transform?.m02 ?? 0
    const y = nc.transform?.m12 ?? 0
    const w = nc.size?.x ?? 0
    const h = nc.size?.y ?? 0
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + w)
    maxY = Math.max(maxY, y + h)
  }

  if (minX === Infinity) return null
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export function importClipboardNodes(
  nodeChanges: KiwiNodeChange[],
  graph: SceneGraph,
  targetParentId: string,
  offsetX = 0,
  offsetY = 0,
  blobs: Uint8Array[] = []
): string[] {
  const guidMap = new Map<string, KiwiNodeChange>()
  const parentMap = new Map<string, string>()
  for (const nc of nodeChanges) {
    if (!nc.guid) continue
    const id = `${nc.guid.sessionID}:${nc.guid.localID}`
    guidMap.set(id, nc)
    if (nc.parentIndex?.guid) {
      parentMap.set(id, `${nc.parentIndex.guid.sessionID}:${nc.parentIndex.guid.localID}`)
    }
  }

  const topLevel: string[] = []
  for (const [id, nc] of guidMap) {
    if (NON_VISUAL_TYPES.has(nc.type ?? '')) continue
    const parentId = parentMap.get(id)
    if (
      !parentId ||
      !guidMap.has(parentId) ||
      NON_VISUAL_TYPES.has(guidMap.get(parentId)?.type ?? '')
    ) {
      topLevel.push(id)
    }
  }

  const created = new Map<string, string>()
  const createdIds: string[] = []

  function createNode(figmaId: string, ourParentId: string) {
    if (created.has(figmaId)) return
    const nc = guidMap.get(figmaId)
    if (!nc) return

    const { nodeType, ...props } = nodeChangeToProps(nc, blobs)
    if (nodeType === 'DOCUMENT' || nodeType === 'VARIABLE') return

    if (ourParentId === targetParentId) {
      props.x = (props.x ?? 0) + offsetX
      props.y = (props.y ?? 0) + offsetY
    }

    const node = graph.createNode(nodeType, ourParentId, props)

    created.set(figmaId, node.id)
    if (ourParentId === targetParentId) createdIds.push(node.id)

    const children: string[] = []
    for (const [childId, pid] of parentMap) {
      if (pid === figmaId && !NON_VISUAL_TYPES.has(guidMap.get(childId)?.type ?? '')) {
        children.push(childId)
      }
    }
    children.sort((a, b) => {
      const aPos = guidMap.get(a)?.parentIndex?.position ?? ''
      const bPos = guidMap.get(b)?.parentIndex?.position ?? ''
      return aPos.localeCompare(bPos)
    })
    for (const childId of children) {
      createNode(childId, node.id)
    }
  }

  for (const id of topLevel) {
    createNode(id, targetParentId)
  }

  for (const [, ourId] of created) {
    const node = graph.getNode(ourId)
    if (!node || node.type !== 'INSTANCE' || node.childIds.length > 0) continue

    const figmaComponentId = node.componentId
    if (!figmaComponentId) continue

    const ourComponentId = created.get(figmaComponentId)
    if (!ourComponentId) continue

    graph.updateNode(ourId, { componentId: ourComponentId })
    graph.populateInstanceChildren(ourId, ourComponentId)
  }

  return createdIds
}

export function buildFigmaClipboardHTML(nodes: SceneNode[], graph: SceneGraph): string | null {
  const compiled = getCompiledSchema()
  const schemaDeflated = deflateSync(getSchemaBytes())

  const docGuid = { sessionID: 0, localID: 0 }
  const canvasGuid = { sessionID: 0, localID: 1 }
  const localIdCounter = { value: 100 }

  const nodeChanges: KiwiNodeChange[] = [
    {
      guid: docGuid,
      type: 'DOCUMENT',
      name: 'Document',
      visible: true,
      opacity: 1,
      phase: 'CREATED',
      transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
    },
    {
      guid: canvasGuid,
      parentIndex: { guid: docGuid, position: '!' },
      type: 'CANVAS',
      name: 'Page 1',
      visible: true,
      opacity: 1,
      phase: 'CREATED',
      transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
    }
  ]

  const blobs: Uint8Array[] = []
  for (let i = 0; i < nodes.length; i++) {
    nodeChanges.push(...sceneNodeToKiwi(nodes[i], canvasGuid, i, localIdCounter, graph, blobs))
  }

  const msg: Record<string, unknown> = {
    type: 'NODE_CHANGES',
    sessionID: 0,
    ackID: 0,
    pasteID: crypto.getRandomValues(new Int32Array(1))[0],
    pasteFileKey: 'openpencil',
    nodeChanges
  }

  if (blobs.length > 0) {
    msg.blobs = blobs.map((bytes) => ({ bytes }))
  }

  const dataRaw = compiled.encodeMessage(msg)
  const figKiwiBinary = buildFigKiwi(schemaDeflated, dataRaw)
  const bufferB64 = binaryToBase64(figKiwiBinary)

  const meta: FigmaClipboardMeta = {
    fileKey: 'openpencil',
    pasteID: msg.pasteID as number,
    dataType: 'scene'
  }
  const metaB64 = btoa(JSON.stringify(meta))

  return (
    `<meta charset='utf-8'>` +
    `<span data-metadata="<!--(figmeta)${metaB64}(/figmeta)-->"></span>` +
    `<span data-buffer="<!--(figma)${bufferB64}(/figma)-->"></span>`
  )
}

// --- Internal copy/paste (OpenPencil ↔ OpenPencil) ---

export function parseOpenPencilClipboard(
  html: string
): Array<SceneNode & { children?: SceneNode[] }> | null {
  const match = html.match(/<!--\(openpencil\)(.*?)\(\/openpencil\)-->/s)
  if (!match) return null

  try {
    const decoded = JSON.parse(atob(match[1]))
    if (decoded.format === 'openpencil/v1' && Array.isArray(decoded.nodes)) {
      restoreTextPictures(decoded.nodes)
      return decoded.nodes
    }
  } catch {
    // Not our format
  }
  return null
}

function restoreTextPictures(nodes: Array<Record<string, unknown>>): void {
  for (const node of nodes) {
    if (typeof node.textPicture === 'string') {
      node.textPicture = base64ToBinary(node.textPicture)
    }
    if (Array.isArray(node.children)) {
      restoreTextPictures(node.children)
    }
  }
}

export type TextPictureBuilder = (node: SceneNode) => Uint8Array | null

export function buildOpenPencilClipboardHTML(
  nodes: SceneNode[],
  graph: SceneGraph,
  textPictureBuilder?: TextPictureBuilder
): string {
  const data = {
    format: 'openpencil/v1',
    nodes: collectNodeTree(nodes, graph, textPictureBuilder)
  }
  return `<!--(openpencil)${btoa(JSON.stringify(data))}(/openpencil)-->`
}

function collectNodeTree(
  nodes: SceneNode[],
  graph: SceneGraph,
  textPictureBuilder?: TextPictureBuilder
): Array<Record<string, unknown>> {
  return nodes.map((node) => {
    const children = graph.getChildren(node.id)
    const serialized: Record<string, unknown> = { ...node }

    if (node.type === 'TEXT' && node.text && textPictureBuilder) {
      const pic = node.textPicture ?? textPictureBuilder(node)
      if (pic) serialized.textPicture = binaryToBase64(pic)
    } else {
      delete serialized.textPicture
    }

    if (children.length > 0) {
      serialized.children = collectNodeTree(children, graph, textPictureBuilder)
    }
    return serialized
  })
}
