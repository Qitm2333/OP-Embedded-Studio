import { existsSync } from 'node:fs'

import { describe, expect, test } from 'bun:test'

import { initCanvasKit } from '#cli/headless'

const MATRIX_PATH = '/tmp/open-pencil-boolean-matrix.png'

describe('boolean visual matrix', () => {
  test('generates a non-empty visual fixture for supported shape cases', async () => {
    const proc = Bun.spawnSync({
      cmd: ['bun', 'tests/engine/render/canvas/visual/boolean-matrix.ts'],
      stdout: 'pipe',
      stderr: 'pipe'
    })
    expect(proc.exitCode).toBe(0)
    expect(existsSync(MATRIX_PATH)).toBe(true)

    const ck = await initCanvasKit()
    const bytes = await Bun.file(MATRIX_PATH).arrayBuffer()
    const image = ck.MakeImageFromEncoded(bytes)
    expect(image).not.toBeNull()
    if (!image) return

    expect(image.width()).toBe(720)
    expect(image.height()).toBe(1200)

    const pixels = image.readPixels(0, 0, {
      width: image.width(),
      height: image.height(),
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    })
    image.delete()

    let coloredPixels = 0
    for (let i = 0; i < pixels.length; i += 4) {
      const isWhite = pixels[i] > 245 && pixels[i + 1] > 245 && pixels[i + 2] > 245
      if (!isWhite && pixels[i + 3] > 0) coloredPixels++
    }
    expect(coloredPixels).toBeGreaterThan(20_000)
  })
})
