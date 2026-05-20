import { describe, test } from 'bun:test'

import figSchema from '#core/kiwi/binary/schema'
import { expectEnumValue, expectFieldNumber, validateSchema } from '#core/kiwi/schema-runtime'

describe('Kiwi schema runtime', () => {
  test('validates the static Figma schema', () => {
    validateSchema(figSchema)
  })

  test('keeps Figma clipboard-derived field numbers for fragile roundtrip fields', () => {
    expectFieldNumber(figSchema, 'NodeChange', 'stackWrap', 323)
    expectFieldNumber(figSchema, 'NodeChange', 'stackCounterSpacing', 324)
    expectFieldNumber(figSchema, 'Glyph', 'emojiCodePoints', 7)
    expectFieldNumber(figSchema, 'Glyph', 'emojiImageSet', 8)
    expectFieldNumber(figSchema, 'Glyph', 'rotation', 9)
    expectFieldNumber(figSchema, 'Paint', 'colorVar', 21)
    expectFieldNumber(figSchema, 'TextLineData', 'sourceDirectionality', 9)

    expectEnumValue(figSchema, 'VariableField', 'TEXT_DATA', 11)
    expectEnumValue(figSchema, 'VariableField', 'STACK_COUNTER_SPACING', 23)
    expectEnumValue(figSchema, 'VariableField', 'OVERRIDDEN_SYMBOL_ID', 37)
  })
})
