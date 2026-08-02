import { describe, expect, test } from 'bun:test'

import type { ModelMessage } from 'ai'

import { compactDesignContext } from '@/app/ai/chat/design-context'

function renderExchange(toolCallId: string, jsx: string): ModelMessage[] {
  return [
    {
      role: 'assistant',
      content: [{ type: 'tool-call', toolCallId, toolName: 'render', input: { jsx } }]
    },
    {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId,
          toolName: 'render',
          output: { type: 'json', value: { id: '0:20', name: 'Screen' } }
        }
      ]
    }
  ]
}

describe('Design context image compaction', () => {
  test('preserves the original tool and assistant sequence', () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: 'Create a dashboard.' },
      ...renderExchange('render-1', '<Frame name="Dashboard" />'),
      { role: 'assistant', content: 'Created the dashboard.' },
      { role: 'user', content: 'Make the title brighter.' }
    ]

    expect(compactDesignContext(messages)).toEqual(messages)
  })

  test('does not truncate text, reasoning, or protocol history', () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: 'Create a round screen.' },
      {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'Provider reasoning.' },
          { type: 'text', text: '<|DSML|tool_calls>' }
        ]
      },
      ...Array.from({ length: 14 }, (_, index) => ({
        role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
        content: `history-${index + 1}`
      })),
      { role: 'user', content: 'Center the content.' }
    ]

    expect(compactDesignContext(messages)).toEqual(messages)
  })

  test('replaces old reference images while preserving the latest request image', () => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Use this first reference.' },
          { type: 'file', data: 'old-image-base64', mediaType: 'image/png' }
        ]
      },
      { role: 'assistant', content: 'Applied the first direction.' },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Use this new reference.' },
          { type: 'file', data: 'new-image-base64', mediaType: 'image/webp' }
        ]
      }
    ]

    const serialized = JSON.stringify(compactDesignContext(messages))
    expect(serialized).not.toContain('old-image-base64')
    expect(serialized).toContain('Earlier reference image omitted')
    expect(serialized).toContain('new-image-base64')
  })
})
