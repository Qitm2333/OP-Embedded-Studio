import { describe, expect, mock, test } from 'bun:test'
import type { Canvas } from 'canvaskit-wasm'

import { drawNodeFill } from '#core/canvas/fills'
import type { SkiaRenderer } from '#core/canvas/renderer'
import { makeSmoothRRectPath } from '#core/canvas/shapes'
import { SceneGraph } from '#core/scene-graph'

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

function createRenderer() {
  const paths: Array<{
    addRect: ReturnType<typeof mock>
    moveTo: ReturnType<typeof mock>
    lineTo: ReturnType<typeof mock>
    close: ReturnType<typeof mock>
    delete: ReturnType<typeof mock>
  }> = []

  class MockPath {
    addRect = mock(() => undefined)
    moveTo = mock(() => undefined)
    lineTo = mock(() => undefined)
    close = mock(() => undefined)
    delete = mock(() => undefined)

    constructor() {
      paths.push(this)
    }
  }

  const renderer = {
    ck: {
      Path: MockPath,
      LTRBRect: mock((l, t, r, b) => new Float32Array([l, t, r, b]))
    },
    fillPaint: {}
  } as SkiaRenderer

  return { renderer, paths }
}

function createCanvas() {
  return {
    drawPath: mock(() => undefined),
    drawRRect: mock(() => undefined),
    drawRect: mock(() => undefined)
  }
}

describe('canvas corner smoothing', () => {
  test('builds a superellipse-style path for smoothed rectangular corners', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 120,
      height: 80,
      cornerRadius: 24,
      cornerSmoothing: 0.75
    })
    const { renderer, paths } = createRenderer()

    makeSmoothRRectPath(renderer, node).delete()

    expect(paths).toHaveLength(1)
    expect(paths[0].moveTo).toHaveBeenCalledWith(24, 0)
    expect(paths[0].lineTo).toHaveBeenCalledWith(96, 0)
    expect(paths[0].lineTo).toHaveBeenCalledTimes(52)
    expect(paths[0].close).toHaveBeenCalled()
  })

  test('draws smoothed rectangle fills as paths instead of regular rrects', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 120,
      height: 80,
      cornerRadius: 24,
      cornerSmoothing: 0.75
    })
    const { renderer } = createRenderer()
    const canvas = createCanvas()

    drawNodeFill(renderer, canvas as Canvas, node, new Float32Array([0, 0, 120, 80]), true)

    expect(canvas.drawPath).toHaveBeenCalled()
    expect(canvas.drawRRect).not.toHaveBeenCalled()
    expect(canvas.drawRect).not.toHaveBeenCalled()
  })
})
