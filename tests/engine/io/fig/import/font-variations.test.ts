import { describe, expect, test } from 'bun:test'

import type { NodeChange } from '#core/kiwi/fig/codec'
import { nodeChangeToProps, importStyleRuns } from '#core/kiwi/fig/node-change/convert'

describe('Figma font variation import', () => {
  test('imports base text variable font axes', () => {
    const props = nodeChangeToProps(
      {
        type: 'TEXT',
        textData: { characters: 'Axis' },
        fontVariations: [
          { axisTag: 0x77676874, axisName: 'Weight', value: 650 },
          { axisName: 'wdth', value: 88 }
        ]
      } as NodeChange,
      []
    )

    expect(props.fontVariations).toEqual([
      { axis: 'wght', value: 650 },
      { axis: 'wdth', value: 88 }
    ])
  })

  test('imports base text OpenType feature toggles', () => {
    const props = nodeChangeToProps(
      {
        type: 'TEXT',
        textData: { characters: 'Ligatures' },
        fontVariantCommonLigatures: false,
        fontVariantContextualLigatures: true,
        toggledOnOTFeatures: ['DLIG'],
        toggledOffOTFeatures: ['KERN']
      } as NodeChange,
      []
    )

    expect(props.fontFeatures).toEqual([
      { tag: 'LIGA', enabled: false },
      { tag: 'CALT', enabled: true },
      { tag: 'DLIG', enabled: true },
      { tag: 'KERN', enabled: false }
    ])
  })

  test('imports text decoration style metadata', () => {
    const props = nodeChangeToProps(
      {
        type: 'TEXT',
        textData: { characters: 'Decorated' },
        textDecoration: 'UNDERLINE',
        textDecorationStyle: 'WAVY',
        textDecorationThickness: { value: 1.5, units: 'PIXELS' },
        textDecorationFillPaints: [
          { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 0.75 }
        ]
      } as NodeChange,
      []
    )

    expect(props).toMatchObject({
      textDecoration: 'UNDERLINE',
      textDecorationStyle: 'WAVY',
      textDecorationThickness: 1.5,
      textDecorationFills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 0.75 }]
    })
  })

  test('imports styled-run variable font axes and OpenType feature toggles', () => {
    const runs = importStyleRuns({
      type: 'TEXT',
      fontSize: 16,
      textData: {
        characters: 'Axis',
        characterStyleIDs: [1, 1, 0, 0],
        styleOverrideTable: [
          {
            styleID: 1,
            fontVariations: [{ axisName: 'GRAD', value: -50 }],
            fontVariantCommonLigatures: false,
            toggledOnOTFeatures: ['SS01'],
            textDecoration: 'UNDERLINE',
            textDecorationStyle: 'DOTTED',
            textDecorationThickness: { value: 2, units: 'PIXELS' }
          } as NodeChange
        ]
      }
    } as NodeChange)

    expect(runs).toEqual([
      {
        start: 0,
        length: 2,
        style: {
          fontVariations: [{ axis: 'GRAD', value: -50 }],
          fontFeatures: [
            { tag: 'LIGA', enabled: false },
            { tag: 'SS01', enabled: true }
          ],
          textDecoration: 'UNDERLINE',
          textDecorationStyle: 'DOTTED',
          textDecorationThickness: 2
        }
      }
    ])
  })
})
