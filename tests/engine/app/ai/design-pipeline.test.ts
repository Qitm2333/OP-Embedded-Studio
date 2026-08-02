import { describe, expect, test } from 'bun:test'

import type { ModelMessage } from 'ai'

import { chatProviderOptions, prepareDesignStep } from '@/app/ai/chat/transports'

describe('Design AI stable pipeline', () => {
  test('passes ordinary message history through unchanged', () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: 'Create a screen.' },
      { role: 'assistant', content: 'I will inspect the canvas.' },
      { role: 'user', content: 'Continue.' }
    ]

    expect(prepareDesignStep(messages)).toEqual({ messages })
  })

  test('does not force a tool choice or inject replacement system messages', () => {
    const prepared = prepareDesignStep([{ role: 'user', content: 'Center the screen.' }])

    expect(prepared).not.toHaveProperty('activeTools')
    expect(prepared).not.toHaveProperty('toolChoice')
    expect(prepared).not.toHaveProperty('system')
  })
})

describe('chatProviderOptions', () => {
  test('disables thinking for every native DeepSeek request', () => {
    expect(chatProviderOptions('deepseek', 'deepseek-v4-flash')).toEqual({
      deepseek: { thinking: { type: 'disabled' } }
    })
    expect(chatProviderOptions('deepseek', 'deepseek-v4-pro')).toEqual({
      deepseek: { thinking: { type: 'disabled' } }
    })
  })

  test('preserves Anthropic prompt caching and leaves unrelated providers unchanged', () => {
    expect(chatProviderOptions('anthropic', 'claude-sonnet-4-6')).toEqual({
      anthropic: { cacheControl: { type: 'ephemeral' } }
    })
    expect(chatProviderOptions('openai', 'gpt-5')).toBeUndefined()
  })
})
