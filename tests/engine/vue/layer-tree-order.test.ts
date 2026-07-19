import { describe, expect, test } from 'bun:test'

import {
  layerDropInsertIndex,
  orderedLayerChildIds
} from '../../../packages/vue/src/primitives/LayerTree/order'

describe('layer tree display order', () => {
  const childIds = ['back', 'middle', 'front']

  test('preserves document order by default', () => {
    expect(orderedLayerChildIds(childIds, 'document')).toEqual(childIds)
  })

  test('shows visually frontmost children first when enabled', () => {
    expect(orderedLayerChildIds(childIds, 'front-first')).toEqual(['front', 'middle', 'back'])
    expect(childIds).toEqual(['back', 'middle', 'front'])
  })

  test('maps drops using document order', () => {
    expect(layerDropInsertIndex(childIds, 'front', 'back', 'above', 'document')).toBe(0)
    expect(layerDropInsertIndex(childIds, 'front', 'back', 'below', 'document')).toBe(1)
  })

  test('maps drops using front-first order', () => {
    expect(layerDropInsertIndex(childIds, 'back', 'middle', 'above', 'front-first')).toBe(1)
    expect(layerDropInsertIndex(childIds, 'back', 'middle', 'below', 'front-first')).toBe(0)
  })
})
