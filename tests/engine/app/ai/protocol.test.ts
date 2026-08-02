import { describe, expect, test } from 'bun:test'

import { isLeakedToolProtocol } from '@/app/ai/chat/protocol'

describe('AI tool protocol leak detection', () => {
  test('detects DeepSeek DSML tool markup', () => {
    expect(isLeakedToolProtocol('<|DSML|tool_calls>\n<|DSML|invoke name="render">')).toBe(true)
  })

  test('detects full-width DSML delimiters', () => {
    expect(isLeakedToolProtocol('<｜DSML｜parameter name="jsx">')).toBe(true)
  })

  test('does not hide an ordinary discussion of DSML', () => {
    expect(isLeakedToolProtocol('DSML is an internal tool-call markup format.')).toBe(false)
  })
})
