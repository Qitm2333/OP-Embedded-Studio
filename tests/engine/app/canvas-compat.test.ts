import { describe, expect, test } from 'bun:test'

import { buildOpenPencilClipboardHTML } from '@open-pencil/core/clipboard'
import { createEditor } from '@open-pencil/core/editor'
import type { Fill, SceneNode } from '@open-pencil/scene-graph'
import { SceneGraph } from '@open-pencil/scene-graph'

import {
  appendClipboardCompatibilityMetadata,
  createClipboardCompatibilityMetadata,
  installClipboardCompatibility,
  parseClipboardCompatibilityMetadata
} from '@/app/editor/canvas-compat/clipboard'
import {
  Matrix,
  nodeWorldMatrix,
  worldCenter,
  worldRotation
} from '@/app/editor/canvas-compat/geometry'
import { installReparentCompatibility } from '@/app/editor/canvas-compat/reparent'
import {
  defaultImageLocalMatrix,
  imageTransformForRect,
  resizedRect
} from '@/app/editor/canvas-compat/use-image-crop'

function expectPointClose(actual: { x: number; y: number }, expected: { x: number; y: number }) {
  expect(actual.x).toBeCloseTo(expected.x, 5)
  expect(actual.y).toBeCloseTo(expected.y, 5)
}

function expectMatrixClose(actual: number[], expected: number[]) {
  expect(actual).toHaveLength(expected.length)
  for (let index = 0; index < actual.length; index++) {
    expect(actual[index]).toBeCloseTo(expected[index], 5)
  }
}

describe('canvas compatibility module', () => {
  test('reparenting between rotated frames preserves world geometry', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const sourceFrame = graph.createNode('FRAME', pageId, {
      x: 80,
      y: 60,
      width: 300,
      height: 240,
      rotation: 24
    })
    const targetFrame = graph.createNode('FRAME', pageId, {
      x: 520,
      y: 180,
      width: 280,
      height: 220,
      rotation: -31
    })
    const child = graph.createNode('RECTANGLE', sourceFrame.id, {
      x: 45,
      y: 35,
      width: 90,
      height: 55,
      rotation: 17
    })
    const centerBefore = worldCenter(graph, child)
    const rotationBefore = worldRotation(graph, child)

    installReparentCompatibility(graph)
    graph.reparentNode(child.id, targetFrame.id)

    const moved = graph.getNode(child.id)
    expect(moved?.parentId).toBe(targetFrame.id)
    expectPointClose(worldCenter(graph, child), centerBefore)
    expect(worldRotation(graph, child)).toBeCloseTo(rotationBefore, 5)
  })

  test('layer-tree reparenting preserves world geometry through undo and redo', () => {
    const editor = createEditor({ skipInitialGraphSetup: true })
    const pageId = editor.graph.getPages()[0].id
    const frame = editor.graph.createNode('FRAME', pageId, {
      x: 320,
      y: 180,
      width: 280,
      height: 240,
      rotation: 23
    })
    const child = editor.graph.createNode('RECTANGLE', pageId, {
      x: 410,
      y: 290,
      width: 90,
      height: 55,
      rotation: -17
    })
    const centerBefore = worldCenter(editor.graph, child)
    const rotationBefore = worldRotation(editor.graph, child)

    installReparentCompatibility(editor.graph)
    editor.reorderChildWithUndo(child.id, frame.id, frame.childIds.length)

    expect(editor.graph.getNode(child.id)?.parentId).toBe(frame.id)
    expectPointClose(worldCenter(editor.graph, child), centerBefore)
    expect(worldRotation(editor.graph, child)).toBeCloseTo(rotationBefore, 5)

    editor.undo.undo()
    expect(editor.graph.getNode(child.id)?.parentId).toBe(pageId)
    expectPointClose(worldCenter(editor.graph, child), centerBefore)
    expect(worldRotation(editor.graph, child)).toBeCloseTo(rotationBefore, 5)

    editor.undo.redo()
    expect(editor.graph.getNode(child.id)?.parentId).toBe(frame.id)
    expectPointClose(worldCenter(editor.graph, child), centerBefore)
    expect(worldRotation(editor.graph, child)).toBeCloseTo(rotationBefore, 5)
  })
  test('clipboard metadata round-trips without changing source HTML', () => {
    const editor = createEditor({ skipInitialGraphSetup: true })
    const pageId = editor.graph.getPages()[0].id
    const node = editor.graph.createNode('RECTANGLE', pageId, {
      x: 25,
      y: 40,
      width: 80,
      height: 60,
      rotation: 12
    })
    const metadata = createClipboardCompatibilityMetadata(editor, [node])
    const html = appendClipboardCompatibilityMetadata('<span>clipboard</span>', metadata)

    expect(html.startsWith('<span>clipboard</span>')).toBe(true)
    expect(parseClipboardCompatibilityMetadata(html)).toEqual(metadata)
  })

  test('cross-frame paste preserves world offset and descendant local positions', async () => {
    const editor = createEditor({ skipInitialGraphSetup: true })
    const pageId = editor.graph.getPages()[0].id
    const sourceFrame = editor.graph.createNode('FRAME', pageId, {
      x: 100,
      y: 70,
      width: 260,
      height: 220
    })
    const targetFrame = editor.graph.createNode('FRAME', pageId, {
      x: 520,
      y: 170,
      width: 300,
      height: 260,
      rotation: 28
    })
    const group = editor.graph.createNode('GROUP', sourceFrame.id, {
      x: 35,
      y: 45,
      width: 120,
      height: 90,
      rotation: 9
    })
    const child = editor.graph.createNode('RECTANGLE', group.id, {
      x: 14,
      y: 18,
      width: 50,
      height: 32
    })
    const sourceCenter = worldCenter(editor.graph, group)
    const html = appendClipboardCompatibilityMetadata(
      buildOpenPencilClipboardHTML([group], editor.graph),
      createClipboardCompatibilityMetadata(editor, [group])
    )

    installClipboardCompatibility(editor)
    editor.select([targetFrame.id])
    await editor.pasteFromHTML(html)

    const pasted = [...editor.state.selectedIds]
      .map((id) => editor.graph.getNode(id))
      .find((node): node is SceneNode => !!node)
    expect(pasted?.parentId).toBe(targetFrame.id)
    expectPointClose(worldCenter(editor.graph, pasted), {
      x: sourceCenter.x + 20,
      y: sourceCenter.y + 20
    })
    const pastedChild = editor.graph.getNode(pasted.childIds[0])
    expect(pastedChild?.x).toBe(child.x)
    expect(pastedChild?.y).toBe(child.y)

    expect(editor.undo.undo()).toBe('Paste')
    expect(editor.graph.getNode(pasted.id)).toBeUndefined()
    expect(editor.undo.redo()).toBe('Paste')
    expect(editor.graph.getNode(pasted.id)).toBeDefined()
  })

  test('crop resize preserves the image-to-world matrix', () => {
    const editor = createEditor({ skipInitialGraphSetup: true })
    const pageId = editor.graph.getPages()[0].id
    const node = editor.graph.createNode('RECTANGLE', pageId, {
      x: 30,
      y: 45,
      width: 160,
      height: 120
    })
    const fill: Fill = {
      type: 'IMAGE',
      color: { r: 1, g: 1, b: 1, a: 1 },
      opacity: 1,
      visible: true,
      imageHash: 'image',
      imageScaleMode: 'FILL'
    }
    const imageWidth = 320
    const imageHeight = 180
    const initialLocal = defaultImageLocalMatrix(fill, node, imageWidth, imageHeight)
    expect(initialLocal).not.toBeNull()
    const imageToWorld = Matrix.multiply(nodeWorldMatrix(editor.graph, node), initialLocal!)
    const rect = resizedRect(
      { x: node.x, y: node.y, width: node.width, height: node.height },
      'e',
      { x: node.x + 105, y: node.y }
    )
    const transform = imageTransformForRect(
      editor,
      node,
      rect,
      imageToWorld,
      imageWidth,
      imageHeight
    )
    expect(transform).not.toBeNull()

    const resizedNode = { ...node, ...rect } as SceneNode
    const cropFill = { ...fill, imageScaleMode: 'CROP', imageTransform: transform } as Fill
    const resizedLocal = defaultImageLocalMatrix(cropFill, resizedNode, imageWidth, imageHeight)
    expect(resizedLocal).not.toBeNull()
    const resizedImageToWorld = Matrix.multiply(
      nodeWorldMatrix(editor.graph, resizedNode),
      resizedLocal!
    )

    expectMatrixClose(resizedImageToWorld, imageToWorld)
  })
})
