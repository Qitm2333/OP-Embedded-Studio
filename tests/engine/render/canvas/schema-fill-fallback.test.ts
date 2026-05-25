import { describe, expect, mock, test } from 'bun:test'

import { applyFill } from '#core/canvas/fills'
import type { SkiaRenderer } from '#core/canvas/renderer'
import { SceneGraph } from '#core/scene-graph'
import type { Fill, SceneNode } from '#core/scene-graph'

function createRenderer() {
  return {
    fillPaint: {
      setShader: mock(() => undefined),
      setColor: mock(() => undefined)
    },
    ck: {
      Color4f: mock((r, g, b, a) => ['color', r, g, b, a])
    },
    resolveFillColor: mock((fill: Fill) => fill.color)
  } as SkiaRenderer
}

const node = { id: '1:2', width: 100, height: 100 } as SceneNode

describe('schema fill fallback rendering', () => {
  test.each(['PATTERN', 'NOISE', 'CUSTOM'] as const)(
    'renders %s fills as solid fallback',
    (type) => {
      const renderer = createRenderer()
      const fill: Fill = {
        type,
        color: { r: 0.2, g: 0.3, b: 0.4, a: 0.8 },
        opacity: 1,
        visible: true
      }

      expect(applyFill(renderer, fill, node, new SceneGraph())).toBe(true)
      expect(renderer.fillPaint.setColor).toHaveBeenCalledWith(['color', 0.2, 0.3, 0.4, 0.8])
    }
  )
})
