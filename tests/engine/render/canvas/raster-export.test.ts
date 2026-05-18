import { beforeAll, describe, expect, test } from 'bun:test'

import { renderNodesToImage, SceneGraph, SkiaRenderer } from '@open-pencil/core'

import { initCanvasKit } from '#cli/headless'

import { expectDefined } from '#tests/helpers/assert'

let ck: Awaited<ReturnType<typeof initCanvasKit>>

beforeAll(async () => {
  ck = await initCanvasKit()
})

describe('raster export', () => {
  test('page exports can trim transparent text padding', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      x: 0,
      y: 0,
      width: 120,
      height: 40,
      text: 'Primitives',
      fontSize: 30,
      lineHeight: 40,
      fills: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    })

    const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
    const renderer = new SkiaRenderer(ck, surface)
    await renderer.loadFonts()

    try {
      const untrimmed = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [text.id], {
          scale: 1,
          format: 'PNG'
        }),
        'untrimmed png'
      )
      const trimmed = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [text.id], {
          scale: 1,
          format: 'PNG',
          trimTransparent: true
        }),
        'trimmed png'
      )

      const untrimmedImage = expectDefined(ck.MakeImageFromEncoded(untrimmed), 'untrimmed image')
      const trimmedImage = expectDefined(ck.MakeImageFromEncoded(trimmed), 'trimmed image')

      expect(untrimmedImage.height()).toBe(40)
      expect(trimmedImage.height()).toBeLessThan(untrimmedImage.height())
      expect(trimmedImage.width()).toBeLessThan(untrimmedImage.width())

      untrimmedImage.delete()
      trimmedImage.delete()
    } finally {
      surface.delete()
    }
  })
})
