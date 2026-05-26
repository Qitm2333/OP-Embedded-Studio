import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

interface PaintOracle {
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
  test('records that real paint payloads are still blocked on Figma-authored samples', () => {
    const oracle = readOracle()
    for (const type of ['PATTERN', 'NOISE', 'CUSTOM']) {
      expect(oracle.pluginRuntimeCreation[type]?.ok).toBe(false)
      expect(oracle.currentFileFillTypes[type]).toBeUndefined()
      for (const counts of Object.values(oracle.localFigFixtureFillTypes)) {
        expect(counts[type]).toBeUndefined()
      }
    }
    expect(oracle.status).toContain('blocked on a Figma-authored sample')
  })
})
