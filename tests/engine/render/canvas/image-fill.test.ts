import { describe, expect, mock, test } from 'bun:test'

import { makeImageFillLocalMatrix } from '#core/canvas/fills'
import type { SkiaRenderer } from '#core/canvas/renderer'
import type { Fill, SceneNode } from '#core/scene-graph'

function createRenderer() {
  return {
    ck: {
      Matrix: {
        identity: mock(() => ['identity']),
        multiply: mock((...matrices) => ['multiply', ...matrices]),
        scaled: mock((x, y) => ['scaled', x, y]),
        translated: mock((x, y) => ['translated', x, y])
      }
    }
  } as SkiaRenderer
}

const node = {
  width: 120,
  height: 80
} as SceneNode

describe('canvas image fills', () => {
  test('keeps untransformed tile fills in image pixel space', () => {
    const renderer = createRenderer()
    const fill = { type: 'IMAGE', imageScaleMode: 'TILE' } as Fill

    const matrix = makeImageFillLocalMatrix(renderer, fill, node, 24, 16)

    expect(matrix).toEqual(['identity'])
    expect(renderer.ck.Matrix.identity).toHaveBeenCalled()
    expect(renderer.ck.Matrix.scaled).not.toHaveBeenCalled()
  })

  test('uses imported tile transforms for patterned image fills', () => {
    const renderer = createRenderer()
    const fill = {
      type: 'IMAGE',
      imageScaleMode: 'TILE',
      imageTransform: { m00: 0.5, m01: 0, m02: 0.25, m10: 0, m11: 0.25, m12: 0.5 }
    } as Fill

    const matrix = makeImageFillLocalMatrix(renderer, fill, node, 40, 40)

    expect(matrix).toEqual(['multiply', ['scaled', 6, 8], ['translated', -10, -20]])
  })
})
