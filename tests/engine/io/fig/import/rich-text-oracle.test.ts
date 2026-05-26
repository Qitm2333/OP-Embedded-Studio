import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import type { NodeChange, Paint } from '#core/kiwi/fig/codec'
import { nodeChangeToProps } from '#core/kiwi/fig/node-change/convert'

interface OracleColor {
  r: number
  g: number
  b: number
}

interface OracleDecorationColor {
  value: {
    color: OracleColor
    opacity: number
  }
}

interface OracleRange {
  start: number
  end: number
  textDecoration: string
  textDecorationStyle: string
  textDecorationThickness: { unit: string; value: number }
  textDecorationColor: OracleDecorationColor
}

interface RichTextOracle {
  characters: string
  leadingTrim: string
  ranges: OracleRange[]
}

function readOracle(): RichTextOracle {
  return JSON.parse(
    readFileSync('tests/fixtures/figma-oracles/rich-text-decoration.json', 'utf8')
  ) as RichTextOracle
}

function oracleColorToPaint(color: OracleDecorationColor): Paint {
  return {
    type: 'SOLID',
    visible: true,
    opacity: color.value.opacity,
    blendMode: 'NORMAL',
    color: { ...color.value.color, a: 1 }
  }
}

function styleIdsForOracle(oracle: RichTextOracle): number[] {
  const ids = Array.from({ length: oracle.characters.length }, () => 0)
  const secondRange = oracle.ranges[1]
  if (!secondRange) return ids
  for (let index = secondRange.start; index < secondRange.end; index++) ids[index] = 1
  return ids
}

describe('Figma rich text oracle', () => {
  test('maps captured Figma text decoration API values to import props', () => {
    const oracle = readOracle()
    const firstRange = oracle.ranges[0]
    const secondRange = oracle.ranges[1]
    expect(firstRange).toBeDefined()
    expect(secondRange).toBeDefined()
    if (!firstRange || !secondRange) return

    const nodeChange: NodeChange = {
      type: 'TEXT',
      textData: {
        characters: oracle.characters,
        characterStyleIDs: styleIdsForOracle(oracle),
        styleOverrideTable: [
          {
            styleID: 1,
            textDecoration: secondRange.textDecoration,
            textDecorationStyle: secondRange.textDecorationStyle,
            textDecorationThickness: {
              value: secondRange.textDecorationThickness.value,
              units: 'PIXELS'
            },
            textDecorationFillPaints: [oracleColorToPaint(secondRange.textDecorationColor)]
          }
        ]
      },
      fontSize: 32,
      textDecoration: firstRange.textDecoration,
      textDecorationStyle: firstRange.textDecorationStyle,
      textDecorationThickness: {
        value: firstRange.textDecorationThickness.value,
        units: 'PIXELS'
      },
      textDecorationFillPaints: [oracleColorToPaint(firstRange.textDecorationColor)],
      leadingTrim: oracle.leadingTrim
    }

    const props = nodeChangeToProps(nodeChange, [])

    expect(props.text).toBe(oracle.characters)
    expect(props.textDecoration).toBe('UNDERLINE')
    expect(props.textDecorationStyle).toBe('WAVY')
    expect(props.textDecorationThickness).toBe(2)
    expect(props.textDecorationFills[0]?.color).toEqual({ r: 1, g: 0, b: 0, a: 1 })
    expect(props.leadingTrim).toBe('CAP_HEIGHT')
    expect(props.styleRuns).toEqual([
      {
        start: secondRange.start,
        length: secondRange.end - secondRange.start,
        style: {
          textDecoration: 'UNDERLINE',
          textDecorationStyle: 'DOTTED',
          textDecorationThickness: 3,
          textDecorationFills: [
            {
              type: 'SOLID',
              visible: true,
              opacity: 1,
              blendMode: 'NORMAL',
              color: { r: 0, g: 0.25, b: 1, a: 1 }
            }
          ]
        }
      }
    ])
  })
})
