import { describe, expect, test } from 'bun:test'

import { sceneNodeToKiwi } from '#core/kiwi/fig/node-change/serialize'
import { SceneGraph } from '#core/scene-graph'

describe('Figma font variation export', () => {
  test('exports base and styled-run variable font axes', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      text: 'Axis',
      fontVariations: [{ axis: 'wght', value: 650 }],
      textDecoration: 'UNDERLINE',
      textDecorationStyle: 'WAVY',
      textDecorationThickness: 1.5,
      textDecorationFills: [
        {
          type: 'SOLID',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          blendMode: 'NORMAL'
        }
      ],
      fontFeatures: [
        { tag: 'LIGA', enabled: false },
        { tag: 'DLIG', enabled: true },
        { tag: 'KERN', enabled: false }
      ],
      styleRuns: [
        {
          start: 0,
          length: 2,
          style: {
            fontVariations: [{ axis: 'wdth', value: 88 }],
            fontFeatures: [
              { tag: 'CALT', enabled: false },
              { tag: 'SS01', enabled: true }
            ],
            textDecoration: 'UNDERLINE',
            textDecorationStyle: 'DOTTED',
            textDecorationThickness: 2
          }
        }
      ]
    })

    const changes = sceneNodeToKiwi(text, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])
    const nodeChange = changes[0]

    expect(nodeChange.fontVariations).toEqual([
      { axisTag: 0x77676874, axisName: 'wght', value: 650 }
    ])
    expect(nodeChange.textDecorationStyle).toBe('WAVY')
    expect(nodeChange.textDecorationThickness).toEqual({ value: 1.5, units: 'PIXELS' })
    expect(nodeChange.textDecorationFillPaints?.[0]?.type).toBe('SOLID')
    expect(nodeChange.fontVariantCommonLigatures).toBe(false)
    expect(nodeChange.fontVariantContextualLigatures).toBe(true)
    expect(nodeChange.toggledOnOTFeatures).toEqual(['DLIG'])
    expect(nodeChange.toggledOffOTFeatures).toEqual(['KERN'])
    expect(nodeChange.textData?.styleOverrideTable?.[0]?.fontVariations).toEqual([
      { axisTag: 0x77647468, axisName: 'wdth', value: 88 }
    ])
    expect(nodeChange.textData?.styleOverrideTable?.[0]?.fontVariantContextualLigatures).toBe(false)
    expect(nodeChange.textData?.styleOverrideTable?.[0]?.toggledOnOTFeatures).toEqual(['SS01'])
    expect(nodeChange.textData?.styleOverrideTable?.[0]?.textDecorationStyle).toBe('DOTTED')
    expect(nodeChange.textData?.styleOverrideTable?.[0]?.textDecorationThickness).toEqual({
      value: 2,
      units: 'PIXELS'
    })
  })
})
