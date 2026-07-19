import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import {
  localRectForWorldCenter,
  normalizeRotation,
  unionRects,
  worldBounds,
  worldCenter,
  worldRotation
} from './geometry'

const METADATA_PATTERN = /<!--\(op-canvas-compat\)(.*?)\(\/op-canvas-compat\)-->/s
const INSTALLED = Symbol('open-pencil-canvas-compat-clipboard')

interface ClipboardTreeSnapshot {
  x: number
  y: number
  children: ClipboardTreeSnapshot[]
}

interface ClipboardRootSnapshot {
  center: Vector
  bounds: Rect
  rotation: number
  tree: ClipboardTreeSnapshot
}

interface ClipboardCompatibilityMetadata {
  version: 1
  roots: ClipboardRootSnapshot[]
}

type ClipboardCompatibilityEditor = Editor & { [INSTALLED]?: boolean }

function snapshotTree(editor: Editor, node: SceneNode): ClipboardTreeSnapshot {
  return {
    x: node.x,
    y: node.y,
    children: node.childIds
      .map((id) => editor.graph.getNode(id))
      .filter((child): child is SceneNode => !!child)
      .map((child) => snapshotTree(editor, child))
  }
}

export function createClipboardCompatibilityMetadata(
  editor: Editor,
  nodes: SceneNode[]
): ClipboardCompatibilityMetadata {
  return {
    version: 1,
    roots: nodes.map((node) => ({
      center: worldCenter(editor.graph, node),
      bounds: worldBounds(editor.graph, node),
      rotation: worldRotation(editor.graph, node),
      tree: snapshotTree(editor, node)
    }))
  }
}

export function appendClipboardCompatibilityMetadata(
  html: string,
  metadata: ClipboardCompatibilityMetadata
): string {
  const encoded = new TextEncoder().encode(JSON.stringify(metadata)).toBase64()
  const cleaned = html.replace(METADATA_PATTERN, '')
  return `${cleaned}<!--(op-canvas-compat)${encoded}(/op-canvas-compat)-->`
}

export function parseClipboardCompatibilityMetadata(
  html: string
): ClipboardCompatibilityMetadata | null {
  const match = html.match(METADATA_PATTERN)
  if (!match) return null
  try {
    const decoded = JSON.parse(
      new TextDecoder().decode(Uint8Array.fromBase64(match[1]))
    ) as ClipboardCompatibilityMetadata
    return decoded.version === 1 && Array.isArray(decoded.roots) ? decoded : null
  } catch {
    return null
  }
}

function isAutoLayoutManaged(editor: Editor, node: SceneNode): boolean {
  const parent = node.parentId ? editor.graph.getNode(node.parentId) : undefined
  return !!parent && parent.layoutMode !== 'NONE' && node.layoutPositioning !== 'ABSOLUTE'
}

function commitPositionCorrection(
  editor: Editor,
  node: SceneNode,
  changes: Partial<Pick<SceneNode, 'x' | 'y' | 'rotation'>>
): void {
  const previous: Partial<SceneNode> = {}
  let changed = false
  for (const key of ['x', 'y', 'rotation'] as const) {
    const value = changes[key]
    if (value === undefined || Math.abs(node[key] - value) < 1e-6) continue
    previous[key] = node[key]
    changed = true
  }
  if (!changed) return
  editor.graph.updateNode(node.id, changes)
  editor.commitNodeUpdate(node.id, previous, 'Paste compatibility')
}

function correctDescendants(
  editor: Editor,
  createdNode: SceneNode,
  source: ClipboardTreeSnapshot
): void {
  const createdChildren = createdNode.childIds
    .map((id) => editor.graph.getNode(id))
    .filter((child): child is SceneNode => !!child)
  const count = Math.min(createdChildren.length, source.children.length)
  for (let index = 0; index < count; index++) {
    const createdChild = createdChildren[index]
    const sourceChild = source.children[index]
    if (!isAutoLayoutManaged(editor, createdChild)) {
      commitPositionCorrection(editor, createdChild, {
        x: sourceChild.x,
        y: sourceChild.y
      })
    }
    correctDescendants(editor, createdChild, sourceChild)
  }
}

function pasteDelta(metadata: ClipboardCompatibilityMetadata, cursorPos?: Vector): Vector {
  if (!cursorPos) return { x: 20, y: 20 }
  const bounds = unionRects(metadata.roots.map((root) => root.bounds))
  if (!bounds) return { x: 0, y: 0 }
  return {
    x: cursorPos.x - (bounds.x + bounds.width / 2),
    y: cursorPos.y - (bounds.y + bounds.height / 2)
  }
}

function correctPastedNodes(
  editor: Editor,
  metadata: ClipboardCompatibilityMetadata,
  cursorPos?: Vector
): void {
  const createdRoots = [...editor.state.selectedIds]
    .map((id) => editor.graph.getNode(id))
    .filter((node): node is SceneNode => !!node)
  const count = Math.min(createdRoots.length, metadata.roots.length)
  const delta = pasteDelta(metadata, cursorPos)

  for (let index = 0; index < count; index++) {
    const created = createdRoots[index]
    const source = metadata.roots[index]
    if (!isAutoLayoutManaged(editor, created)) {
      const targetCenter = {
        x: source.center.x + delta.x,
        y: source.center.y + delta.y
      }
      const localRect = localRectForWorldCenter(
        editor.graph,
        created.parentId,
        targetCenter,
        created.width,
        created.height
      )
      const parent = created.parentId ? editor.graph.getNode(created.parentId) : undefined
      const parentRotation = parent ? worldRotation(editor.graph, parent) : 0
      if (localRect) {
        commitPositionCorrection(editor, created, {
          ...localRect,
          rotation: normalizeRotation(source.rotation - parentRotation)
        })
      }
    }
    correctDescendants(editor, created, source.tree)
  }
}

export function installClipboardCompatibility(editor: Editor): void {
  const patched = editor as ClipboardCompatibilityEditor
  if (patched[INSTALLED]) return
  patched[INSTALLED] = true

  const originalWriteCopyData = editor.writeCopyData.bind(editor)
  editor.writeCopyData = async (data: DataTransfer) => {
    const selected = editor.getSelectedNodes()
    await originalWriteCopyData(data)
    const html = data.getData('text/html')
    if (!html || selected.length === 0) return
    data.setData(
      'text/html',
      appendClipboardCompatibilityMetadata(
        html,
        createClipboardCompatibilityMetadata(editor, selected)
      )
    )
  }

  const originalPasteFromHTML = editor.pasteFromHTML.bind(editor)
  editor.pasteFromHTML = async (html: string, cursorPos?: Vector, options = {}) => {
    const metadata = parseClipboardCompatibilityMetadata(html)
    if (!metadata) {
      await originalPasteFromHTML(html, cursorPos, options)
      return
    }

    editor.undo.beginBatch('Paste')
    try {
      await originalPasteFromHTML(html, cursorPos, options)
      correctPastedNodes(editor, metadata, cursorPos)
      editor.undo.commitBatch()
      editor.requestRender()
    } catch (error) {
      editor.undo.rollbackBatch()
      throw error
    }
  }
}
