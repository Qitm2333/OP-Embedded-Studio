import { describe, expect, test } from 'bun:test'

import { snapFigmaDerivedGlyphBaseline } from '#core/canvas/text-derived'

describe('derived text rendering', () => {
  test('snaps Figma glyph baselines to device pixels', () => {
    expect(snapFigmaDerivedGlyphBaseline(47.45454406738281)).toBe(47)
    expect(snapFigmaDerivedGlyphBaseline(15.090909004211426)).toBe(15)
    expect(snapFigmaDerivedGlyphBaseline(17.81818199157715)).toBe(18)
  })
})
