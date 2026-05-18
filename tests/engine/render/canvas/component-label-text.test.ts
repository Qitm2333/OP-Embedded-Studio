import { describe, expect, test } from 'bun:test'

import { ellipsizeComponentLabel } from '#core/canvas/labels/draw'

const fixedWidthFont = {
  getGlyphIDs(text: string) {
    return [...text].map((_, index) => index)
  },
  getGlyphWidths(glyphs: number[]) {
    return glyphs.map(() => 10)
  }
} as Parameters<typeof ellipsizeComponentLabel>[0]

describe('component label text', () => {
  test('keeps labels that fit inside the component width', () => {
    expect(ellipsizeComponentLabel(fixedWidthFont, 'Button', 60)).toBe('Button')
  })

  test('ellipsizes labels that exceed the component width', () => {
    expect(ellipsizeComponentLabel(fixedWidthFont, 'Very long component', 55)).toBe('Very…')
  })

  test('returns only ellipsis when only the ellipsis fits', () => {
    expect(ellipsizeComponentLabel(fixedWidthFont, 'Component', 10)).toBe('…')
  })
})
