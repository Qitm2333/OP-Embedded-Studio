import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import {
  getDesignHandoffMemory,
  recordDesignHandoff,
  resolveDesignHandoffFrame
} from '@/app/ai/device/memory'
import { prepareDevicePrototypeProposal } from '@/app/ai/device/prototype'
import {
  getDevicePrototypeFrameCandidates,
  getSelectedDevicePrototypeFrameCandidates
} from '@/app/editor/device-prototype'
import {
  bakeEmbeddedFrameById,
  getEmbeddedFrameBakeState
} from '@/app/editor/embedded-display-bake'
import { createEditorStore, type EditorStore } from '@/app/editor/session'
import {
  calculatePixelPerfectPlacement,
  imageFileToRgb565
} from '@/features/embedded-display/adapters/image'
import type { EmbeddedDisplayProfile } from '@/features/embedded-display/model/types'

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
      reason: '已选中 2 个画面，请使用下方的交互烧录'
    })
  })

  test('accepts a selected top-level image as a direct deployment source', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const image = graph.createNode('RECTANGLE', pageId, {
      name: 'Imported photo',
      width: 320,
      height: 180,
      fills: [
        {
          type: 'IMAGE',
          imageHash: 'image-hash',
          imageScaleMode: 'FILL',
          color: { r: 0, g: 0, b: 0, a: 0 },
          opacity: 1,
          visible: true
        }
      ]
    })

    expect(getEmbeddedFrameBakeState(editorStore(graph, [image.id]))).toMatchObject({
      available: true,
      id: image.id,
      sourceKind: 'image',
      name: 'Imported photo',
      width: 320,
      height: 180
    })
  })

  test('bakes a top-level image node into a deployment PNG', async () => {
    const graph = new SceneGraph()
    const image = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
      name: 'Imported photo',
      width: 320,
      height: 180,
      fills: [
        {
          type: 'IMAGE',
          imageHash: 'image-hash',
          imageScaleMode: 'FILL',
          color: { r: 0, g: 0, b: 0, a: 0 },
          opacity: 1,
          visible: true
        }
      ]
    })
    const store = editorStore(graph, [image.id])
    store.renderExportImage = async (nodeIds) => {
      expect(nodeIds).toEqual([image.id])
      return new Uint8Array([1, 2, 3])
    }

    const file = await bakeEmbeddedFrameById(store, image.id)
    if (!file) throw new Error('Expected the selected image to bake')
    expect(file.name).toBe('Imported_photo.png')
    expect(file.type).toBe('image/png')
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
  })

  test('exposes multiple selected images as distinct interaction candidates', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const imageFill = {
      type: 'IMAGE' as const,
      imageHash: 'image-hash',
      imageScaleMode: 'FILL' as const,
      color: { r: 0, g: 0, b: 0, a: 0 },
      opacity: 1,
      visible: true
    }
    const first = graph.createNode('RECTANGLE', pageId, {
      name: 'Screen',
      width: 240,
      height: 240,
      fills: [imageFill]
    })
    const second = graph.createNode('RECTANGLE', pageId, {
      name: 'Screen',
      width: 466,
      height: 466,
      fills: [{ ...imageFill, imageHash: 'other-image-hash' }]
    })
    const store = editorStore(graph, [first.id, second.id])

    expect(getSelectedDevicePrototypeFrameCandidates(store)).toEqual([
      expect.objectContaining({ id: first.id, sourceKind: 'image', name: 'Screen (1)' }),
      expect.objectContaining({ id: second.id, sourceKind: 'image', name: 'Screen (2)' })
    ])
    expect(getDevicePrototypeFrameCandidates(store).map((candidate) => candidate.id)).toEqual([
      first.id,
      second.id
    ])
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
      reason: '当前选择不是可烧录的 Frame 或图片'
    })
    expect(getEmbeddedFrameBakeState(editorStore(graph, [page.id]))).toMatchObject({
      available: false
    })
    expect(getEmbeddedFrameBakeState(editorStore(graph, [graph.rootId]))).toMatchObject({
      available: false
    })
  })
})

describe('device AI design handoff', () => {
  test('falls back to the only top-level Frame when selection is empty', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', graph.getPages()[0].id, {
      name: 'Device UI',
      width: 466,
      height: 466
    })
    const store = editorStore(graph, [])

    expect(resolveDesignHandoffFrame(store)).toMatchObject({
      available: true,
      id: frame.id,
      name: 'Device UI'
    })
    expect(getDesignHandoffMemory(store).frame?.source).toBe('user-design')
  })

  test('keeps the latest AI Frame as compact shared memory and detects later edits', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const aiFrame = graph.createNode('FRAME', pageId, {
      name: 'AI Dashboard',
      width: 466,
      height: 466
    })
    graph.createNode('FRAME', pageId, { name: 'Other Frame', width: 240, height: 240 })
    const store = editorStore(graph, [])
    recordDesignHandoff(store, {
      frameId: aiFrame.id,
      frameName: aiFrame.name,
      observation: '完成主界面',
      intent: '建立清晰的信息层级',
      changes: ['放大主数据', '保留圆屏安全区']
    })

    expect(resolveDesignHandoffFrame(store).id).toBe(aiFrame.id)
    expect(getDesignHandoffMemory(store)).toMatchObject({
      frame: {
        id: aiFrame.id,
        source: 'ai-assisted',
        changedAfterAISummary: false
      },
      recentAI: {
        observation: '完成主界面',
        intent: '建立清晰的信息层级'
      }
    })

    graph.updateNode(aiFrame.id, { name: 'AI Dashboard Revised' })
    expect(getDesignHandoffMemory(store).frame?.changedAfterAISummary).toBe(true)
  })
})

describe('device interaction deployment lifecycle', () => {
  test('supersedes an older unconfirmed interaction proposal', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const first = graph.createNode('FRAME', pageId, {
      name: 'Screen',
      width: 240,
      height: 240
    })
    const second = graph.createNode('FRAME', pageId, {
      name: 'Screen',
      width: 466,
      height: 466
    })
    const store = editorStore(graph, [])
    const proposalInput = {
      intent: '创建点击切换交互',
      name: '快速切换',
      frameIds: [first.id, second.id],
      initialFrameId: first.id,
      transitions: [
        { fromFrameId: first.id, event: 'screen_click' as const, toFrameId: second.id },
        { fromFrameId: second.id, event: 'screen_click' as const, toFrameId: first.id }
      ]
    }

    const previous = prepareDevicePrototypeProposal(store, proposalInput)
    const latest = prepareDevicePrototypeProposal(store, {
      ...proposalInput,
      name: '快速切换 2'
    })

    expect(previous.status).toBe('superseded')
    expect(previous.message).toBe('已由新的交互烧录计划替代')
    expect(latest.status).toBe('ready')
    expect(latest.definition.states.map((state) => state.name)).toEqual([
      'Screen (1)',
      'Screen (2)'
    ])
  })

  test('preserves an AI-selected slideshow mode without requiring event transitions', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const first = graph.createNode('FRAME', pageId, { name: 'One', width: 466, height: 466 })
    const second = graph.createNode('FRAME', pageId, { name: 'Two', width: 466, height: 466 })
    const proposal = prepareDevicePrototypeProposal(editorStore(graph, []), {
      intent: '每两秒自动播放',
      name: '自动播放',
      mode: 'slideshow',
      frameIds: [first.id, second.id],
      initialFrameId: first.id,
      transitions: [],
      slideshow: { intervalMs: 2000 }
    })

    expect(proposal.mode).toBe('slideshow')
    expect(proposal.slideshow.intervalMs).toBe(2000)
    expect(proposal.definition.transitions).toEqual([])
  })

  test('turns an AI-selected manual mode into ordered previous and next rules', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const first = graph.createNode('FRAME', pageId, { name: 'One', width: 466, height: 466 })
    const second = graph.createNode('FRAME', pageId, { name: 'Two', width: 466, height: 466 })
    const third = graph.createNode('FRAME', pageId, { name: 'Three', width: 466, height: 466 })
    const proposal = prepareDevicePrototypeProposal(editorStore(graph, []), {
      intent: '点击下一张，长按上一张',
      name: '手动浏览',
      mode: 'manual',
      frameIds: [first.id, second.id, third.id],
      initialFrameId: first.id,
      manual: { nextEvent: 'screen_click', previousEvent: 'screen_long_press', loop: true }
    })

    expect(proposal.mode).toBe('manual')
    expect(proposal.definition.transitions).toContainEqual({
      fromStateId: first.id,
      event: 'screen_click',
      toStateId: second.id
    })
    expect(proposal.definition.transitions).toContainEqual({
      fromStateId: first.id,
      event: 'screen_long_press',
      toStateId: third.id
    })
    expect(proposal.definition.transitions).toHaveLength(6)
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

describe('embedded display image placement', () => {
  const profile: EmbeddedDisplayProfile = {
    id: 'placement-test',
    name: 'Placement test',
    controller: 'TEST',
    resolution: { width: 4, height: 4 },
    interface: 'TEST',
    backgroundColor: '#000000',
    description: 'Placement test profile',
    verified: true
  }

  async function render(placement: 'stretch' | 'contain') {
    const descriptors = {
      createImageBitmap: Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap'),
      document: Object.getOwnPropertyDescriptor(globalThis, 'document')
    }
    const drawCalls: unknown[][] = []
    const context = {
      fillStyle: '',
      imageSmoothingEnabled: true,
      fillRect: () => undefined,
      drawImage: (...args: unknown[]) => drawCalls.push(args),
      getImageData: () => ({ data: new Uint8ClampedArray(4 * 4 * 4) })
    }
    Object.defineProperty(globalThis, 'createImageBitmap', {
      configurable: true,
      value: async () => ({ width: 2, height: 1, close: () => undefined })
    })
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { createElement: () => ({ width: 0, height: 0, getContext: () => context }) }
    })

    try {
      await imageFileToRgb565(new File([new Uint8Array([0])], 'frame.png'), profile, {
        placement,
        backgroundColor: '#123456'
      })
      return { context, drawCalls }
    } finally {
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else Reflect.deleteProperty(globalThis, key)
      }
    }
  }

  test('stretches a source image to the full device resolution', async () => {
    const { context, drawCalls } = await render('stretch')
    expect(context.fillStyle).toBe('#123456')
    expect(drawCalls[0]?.slice(1)).toEqual([0, 0, 4, 4])
  })

  test('preserves aspect ratio and centers the scaled image', async () => {
    const { context, drawCalls } = await render('contain')
    expect(context.fillStyle).toBe('#123456')
    expect(drawCalls[0]?.slice(1)).toEqual([0, 1, 4, 2])
  })
})
