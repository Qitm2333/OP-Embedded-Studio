import { describe, test } from 'bun:test'

import figSchema from '#core/kiwi/fig/codec/schema'
import { expectEnumValue, expectFieldNumber, validateSchema } from '#core/kiwi/schema-runtime'

describe('Kiwi schema runtime', () => {
  test('validates the static Figma schema', () => {
    validateSchema(figSchema)
  })

  test('keeps Figma clipboard-derived field numbers for emitted roundtrip fields', () => {
    expectFieldNumber(figSchema, 'Paint', 'colorVar', 21)
    expectFieldNumber(figSchema, 'TextLineData', 'sourceDirectionality', 9)
    expectFieldNumber(figSchema, 'NodeChange', 'pageType', 397)

    expectEnumValue(figSchema, 'VariableField', 'TEXT_DATA', 11)
    expectEnumValue(figSchema, 'VariableField', 'STACK_COUNTER_SPACING', 23)
    expectEnumValue(figSchema, 'VariableField', 'OVERRIDDEN_SYMBOL_ID', 37)
    expectEnumValue(figSchema, 'EditorType', 'DESIGN', 0)
    expectEnumValue(figSchema, 'EditorType', 'SLIDES', 2)
  })

  test('keeps export-stable legacy field numbers for unused layout and glyph fields', () => {
    expectFieldNumber(figSchema, 'NodeChange', 'stackWrap', 476)
    expectFieldNumber(figSchema, 'NodeChange', 'stackCounterSpacing', 477)
    expectFieldNumber(figSchema, 'Glyph', 'rotation', 7)
  })
})
