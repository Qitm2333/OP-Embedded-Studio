import { describe, expect, test } from 'bun:test'

import { describeAIError } from '@/app/ai/chat/errors'

describe('AI error descriptions', () => {
  test('classifies upstream service failures as provider errors', () => {
    const description = describeAIError(
      '{"message":"Upstream service temporarily unavailable","type":"upstream_error"}'
    )

    expect(description.kind).toBe('provider')
    expect(description.title).toBe('Model provider unavailable')
    expect(description.retryable).toBe(true)
  })
})
