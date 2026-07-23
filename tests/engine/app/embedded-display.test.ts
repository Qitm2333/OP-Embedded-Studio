import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { getEmbeddedFrameBakeState } from '@/app/editor/embedded-display-bake'
import { createEditorStore, type EditorStore } from '@/app/editor/session'
import { calculatePixelPerfectPlacement } from '@/features/embedded-display/adapters/image'

function editorStore(graph: SceneGraph, selectedIds: string[]): EditorStore {
  const store = createEditorStore(graph)
  store.select(selectedIds)
  return store
}

describe('embedded display Frame targeting', () => {
  test('resolves descendants to the nearest containing Frame', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const outerFrame = graph.createNode('FRAME', pageId, {
      name: 'Outer',
      width: 466,
      height: 466
    })
    const innerFrame = graph.createNode('FRAME', outerFrame.id, {
      name: 'Inner',
      width: 240,
      height: 240
    })
    const group = graph.createNode('GROUP', innerFrame.id, {
      width: 100,
      height: 100
    })
    const child = graph.createNode('RECTANGLE', group.id, {
      width: 20,
      height: 20
    })

    expect(getEmbeddedFrameBakeState(editorStore(graph, [child.id]))).toMatchObject({
      id: innerFrame.id,
      available: true,
      name: 'Inner',
      width: 240,
      height: 240
    })
  })

  test('accepts multiple selected elements only when they share one Frame', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const firstFrame = graph.createNode('FRAME', pageId, {
      width: 240,
      height: 240
    })
    const secondFrame = graph.createNode('FRAME', pageId, {
      width: 240,
      height: 240
    })
    const first = graph.createNode('RECTANGLE', firstFrame.id, {
      width: 20,
      height: 20
    })
    const second = graph.createNode('TEXT', firstFrame.id, {
      width: 20,
      height: 20
    })
    const other = graph.createNode('RECTANGLE', secondFrame.id, {
      width: 20,
      height: 20
    })

    expect(getEmbeddedFrameBakeState(editorStore(graph, [first.id, second.id]))).toMatchObject({
      id: firstFrame.id,
      available: true
    })
    expect(getEmbeddedFrameBakeState(editorStore(graph, [first.id, other.id]))).toMatchObject({
      available: false,
      reason: '选中的对象属于不同 Frame'
    })
  })

  test('never treats the page Canvas or document root as a device Frame', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const topLevel = graph.createNode('RECTANGLE', page.id, {
      width: 20,
      height: 20
    })

    expect(getEmbeddedFrameBakeState(editorStore(graph, [topLevel.id]))).toMatchObject({
      available: false,
      reason: '当前选中对象不在 Frame 内'
    })
    expect(getEmbeddedFrameBakeState(editorStore(graph, [page.id]))).toMatchObject({
      available: false
    })
    expect(getEmbeddedFrameBakeState(editorStore(graph, [graph.rootId]))).toMatchObject({
      available: false
    })
  })
})

describe('embedded display pixel-perfect fallback', () => {
  test('centers a smaller image without scaling it', () => {
    expect(
      calculatePixelPerfectPlacement({ width: 240, height: 200 }, { width: 466, height: 466 })
    ).toEqual({
      sourceX: 0,
      sourceY: 0,
      width: 240,
      height: 200,
      destinationX: 113,
      destinationY: 133
    })
  })

  test('center-crops an oversized image without scaling it', () => {
    expect(
      calculatePixelPerfectPlacement({ width: 500, height: 480 }, { width: 466, height: 466 })
    ).toEqual({
      sourceX: 17,
      sourceY: 7,
      width: 466,
      height: 466,
      destinationX: 0,
      destinationY: 0
    })
  })
})
