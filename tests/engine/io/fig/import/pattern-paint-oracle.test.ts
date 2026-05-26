import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import type { Vector } from '#core/types'

interface PatternOracleFill {
  type: string
  sourceNodeId: string
  tileType: string
  spacing: Vector
  horizontalAlignment: string
  verticalAlignment: string
}

interface PaintOracle {
  pattern: {
    source: { id: string }
    target: { fills: PatternOracleFill[] }
  }
  pluginRuntimeCreation: Record<string, { ok: boolean; message: string }>
  currentFileFillTypes: Record<string, number>
  localFigFixtureFillTypes: Record<string, Record<string, number>>
  status: string
}

function readOracle(): PaintOracle {
  return JSON.parse(
    readFileSync('tests/fixtures/figma-oracles/pattern-noise-custom-paints.json', 'utf8')
  ) as PaintOracle
}

describe('Figma pattern/noise/custom paint oracle availability', () => {
  test('records the live Figma pattern paint payload', () => {
    const patternFill = readOracle().pattern.target.fills[0]

    expect(patternFill?.type).toBe('PATTERN')
    expect(patternFill?.sourceNodeId).toBe(readOracle().pattern.source.id)
    expect(patternFill?.tileType).toBe('RECTANGULAR')
    expect(patternFill?.spacing.x).toBe(0.25)
    expect(patternFill?.spacing.y).toBeCloseTo(0.4)
    expect(patternFill?.horizontalAlignment).toBe('CENTER')
    expect(patternFill?.verticalAlignment).toBe('CENTER')
  })

  test('records that noise and custom payloads are still blocked on Figma-authored samples', () => {
    const oracle = readOracle()
    expect(oracle.pluginRuntimeCreation.PATTERN_DIRECT_FILLS_ASSIGNMENT?.ok).toBe(false)

    for (const type of ['NOISE', 'CUSTOM']) {
      expect(oracle.pluginRuntimeCreation[type]?.ok).toBe(false)
      expect(oracle.currentFileFillTypes[type]).toBeUndefined()
      for (const counts of Object.values(oracle.localFigFixtureFillTypes)) {
        expect(counts[type]).toBeUndefined()
      }
    }
    expect(oracle.status).toContain('NOISE and CUSTOM')
  })
})
