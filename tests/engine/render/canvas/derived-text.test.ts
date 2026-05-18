import { beforeAll, describe, expect, test } from 'bun:test'

import { renderNodesToImage, SceneGraph, SkiaRenderer } from '@open-pencil/core'

import { initCanvasKit } from '#cli/headless'
import {
  shouldUseHardFigmaDerivedGlyphCoverage,
  snapFigmaDerivedGlyphBaseline
} from '#core/canvas/text-derived'

import { expectDefined } from '#tests/helpers/assert'

let ck: Awaited<ReturnType<typeof initCanvasKit>>

beforeAll(async () => {
  ck = await initCanvasKit()
})

function squareCommandsBlob(): Uint8Array {
  const blob = new Uint8Array(1 + 4 * 9 + 1)
  const view = new DataView(blob.buffer)
  let offset = 0
  const commands = [
    { command: 1, x: 0, y: 0 },
    { command: 2, x: 1, y: 0 },
    { command: 2, x: 1, y: 1 },
    { command: 2, x: 0, y: 1 }
  ]
  for (const { command, x, y } of commands) {
    blob[offset] = command
    view.setFloat32(offset + 1, x, true)
    view.setFloat32(offset + 5, y, true)
    offset += 9
  }
  blob[offset] = 0
  return blob
}

describe('derived text rendering', () => {
  test('snaps Figma glyph baselines to device pixels', () => {
    expect(snapFigmaDerivedGlyphBaseline(47.45454406738281)).toBe(47)
    expect(snapFigmaDerivedGlyphBaseline(15.090909004211426)).toBe(15)
    expect(snapFigmaDerivedGlyphBaseline(17.81818199157715)).toBe(18)
  })

  test('uses hard source coverage only for regular 20px derived glyphs', () => {
    expect(shouldUseHardFigmaDerivedGlyphCoverage({ fontSize: 20, fontWeight: 400 })).toBeTrue()
    expect(shouldUseHardFigmaDerivedGlyphCoverage({ fontSize: 20, fontWeight: 600 })).toBeFalse()
    expect(shouldUseHardFigmaDerivedGlyphCoverage({ fontSize: 14, fontWeight: 500 })).toBeFalse()
  })

  test('draws Figma-derived glyphs even when the font is unavailable', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      width: 20,
      height: 20,
      text: 'x',
      fontFamily: '__MissingFont__',
      fills: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      figmaDerivedTextGlyphs: [
        {
          commandsBlob: squareCommandsBlob(),
          x: 2,
          y: 12,
          fontSize: 10
        }
      ]
    })

    const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
    const renderer = new SkiaRenderer(ck, surface)

    try {
      const png = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [text.id], {
          scale: 1,
          format: 'PNG'
        }),
        'png'
      )
      const image = expectDefined(ck.MakeImageFromEncoded(png), 'image')
      const pixels = expectDefined(
        image.readPixels(0, 0, {
          alphaType: ck.AlphaType.Unpremul,
          colorType: ck.ColorType.RGBA_8888,
          colorSpace: ck.ColorSpace.SRGB,
          width: image.width(),
          height: image.height()
        }),
        'pixels'
      )

      expect(Math.max(...pixels.filter((_, index) => index % 4 === 3))).toBeGreaterThan(0)
      image.delete()
    } finally {
      surface.delete()
    }
  })
})
