import { describe, expect, test } from 'bun:test'

import { importNodeChanges } from '@open-pencil/core'

import { canvas, doc, node } from './helpers'

describe('fig-import: text properties', () => {
  test('text auto resize', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('TEXT', 10, 1, {
        textData: { characters: 'Hello' },
        fontSize: 16,
        textAlignHorizontal: 'CENTER',
        textAutoResize: 'WIDTH_AND_HEIGHT'
      } as Partial<NodeChange>)
    ])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.textAutoResize).toBe('WIDTH_AND_HEIGHT')
    expect(n.textAlignHorizontal).toBe('CENTER')
  })

  test('uses derived line metrics for imported Figma text rendering', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('TEXT', 10, 1, {
        textData: { characters: 'Default' },
        fontSize: 14,
        lineHeight: { value: 36, units: 'PIXELS' },
        derivedTextData: {
          layoutSize: { x: 49, y: 14 },
          baselines: [
            {
              firstCharacter: 0,
              endCharacter: 7,
              position: { x: 0, y: 12.09 },
              width: 48.25,
              lineY: 0,
              lineHeight: 16.94,
              lineAscent: 13
            }
          ]
        }
      } as Partial<NodeChange>)
    ])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.lineHeight).toBe(16.94)
  })

  test('applies shared text style refs', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('TEXT', 20, 1, {
        name: 'Body style',
        styleType: 'TEXT',
        fontSize: 16,
        fontName: { family: 'Inter', style: 'Regular' },
        lineHeight: { value: 24, units: 'PIXELS' }
      } as Partial<NodeChange>),
      node('TEXT', 10, 1, {
        textData: { characters: 'Styled text' },
        fontSize: 48,
        fontName: { family: 'Inter', style: 'Extra Bold' },
        textDecoration: 'UNDERLINE',
        styleIdForText: { guid: { sessionID: 1, localID: 20 } }
      } as Partial<NodeChange>)
    ])
    const styled = graph.getChildren(graph.getPages()[0].id).find((node) => node.text === 'Styled text')
    expect(styled?.fontSize).toBe(16)
    expect(styled?.fontWeight).toBe(400)
    expect(styled?.lineHeight).toBe(24)
    expect(styled?.textDecoration).toBe('NONE')
  })

  test('font weight mapping', () => {
    const cases = [
      ['Bold', 700],
      ['Semi Bold', 600],
      ['Light', 300],
      ['ExtraBold', 800],
      ['Black', 900],
      ['Thin', 100],
      ['Medium', 500],
      ['Regular', 400]
    ] as const

    for (const [style, expected] of cases) {
      const graph = importNodeChanges([
        doc(),
        canvas(),
        node('TEXT', 10, 1, {
          textData: { characters: 'X' },
          fontName: { family: 'Inter', style }
        } as Partial<NodeChange>)
      ])
      const n = graph.getChildren(graph.getPages()[0].id)[0]
      expect(n.fontWeight).toBe(expected)
    }
  })
})
