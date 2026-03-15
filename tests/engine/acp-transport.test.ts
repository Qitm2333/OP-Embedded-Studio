import { describe, expect, test } from 'bun:test'

import { mapUpdate } from '../../src/ai/acp-transport'

import type { SessionUpdate } from '@agentclientprotocol/sdk'

const TEXT_ID = 'text-1'

describe('mapUpdate', () => {
  test('agent_message_chunk with non-empty text starts text and emits delta', () => {
    const update: SessionUpdate = {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'Hello' }
    }
    const result = mapUpdate(update, TEXT_ID, false)
    expect(result.textStarted).toBe(true)
    expect(result.chunks).toEqual([
      { type: 'text-start', id: TEXT_ID },
      { type: 'text-delta', id: TEXT_ID, delta: 'Hello' }
    ])
  })

  test('agent_message_chunk with empty text is skipped', () => {
    const update: SessionUpdate = {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: '' }
    }
    const result = mapUpdate(update, TEXT_ID, false)
    expect(result.textStarted).toBe(false)
    expect(result.chunks).toEqual([])
  })

  test('subsequent agent_message_chunk does not re-emit text-start', () => {
    const update: SessionUpdate = {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'world' }
    }
    const result = mapUpdate(update, TEXT_ID, true)
    expect(result.textStarted).toBe(true)
    expect(result.chunks).toEqual([
      { type: 'text-delta', id: TEXT_ID, delta: 'world' }
    ])
  })

  test('agent_thought_chunk emits reasoning start/delta/end', () => {
    const update: SessionUpdate = {
      sessionUpdate: 'agent_thought_chunk',
      content: { type: 'text', text: 'thinking...' }
    }
    const result = mapUpdate(update, TEXT_ID, false)
    expect(result.chunks).toHaveLength(3)
    expect(result.chunks[0].type).toBe('reasoning-start')
    expect(result.chunks[1]).toEqual({
      type: 'reasoning-delta',
      id: `reasoning-${TEXT_ID}`,
      delta: 'thinking...'
    })
    expect(result.chunks[2].type).toBe('reasoning-end')
  })

  test('tool_call emits tool-input-start', () => {
    const update: SessionUpdate = {
      sessionUpdate: 'tool_call',
      toolCallId: 'tc-1',
      title: 'create_shape',
      kind: 'edit',
      status: 'pending'
    }
    const result = mapUpdate(update, TEXT_ID, false)
    expect(result.chunks).toEqual([{
      type: 'tool-input-start',
      toolCallId: 'tc-1',
      toolName: 'create_shape',
      providerExecuted: true,
      title: 'create_shape'
    }])
  })

  test('tool_call with rawInput emits tool-input-available', () => {
    const update: SessionUpdate = {
      sessionUpdate: 'tool_call',
      toolCallId: 'tc-2',
      title: 'set_fill',
      kind: 'edit',
      status: 'pending',
      rawInput: { id: '1:2', color: '#ff0000' }
    }
    const result = mapUpdate(update, TEXT_ID, false)
    expect(result.chunks).toHaveLength(2)
    expect(result.chunks[1]).toEqual({
      type: 'tool-input-available',
      toolCallId: 'tc-2',
      toolName: 'set_fill',
      input: { id: '1:2', color: '#ff0000' },
      providerExecuted: true,
      title: 'set_fill'
    })
  })

  test('tool_call with empty title falls back to "unknown"', () => {
    const update: SessionUpdate = {
      sessionUpdate: 'tool_call',
      toolCallId: 'tc-3',
      title: '',
      kind: 'other',
      status: 'pending'
    }
    const result = mapUpdate(update, TEXT_ID, false)
    expect(result.chunks[0]).toMatchObject({ toolName: 'unknown' })
  })

  test('tool_call_update completed emits tool-output-available', () => {
    const update: SessionUpdate = {
      sessionUpdate: 'tool_call_update',
      toolCallId: 'tc-1',
      status: 'completed',
      rawOutput: { id: '1:5', type: 'RECTANGLE' }
    }
    const result = mapUpdate(update, TEXT_ID, false)
    expect(result.chunks).toEqual([{
      type: 'tool-output-available',
      toolCallId: 'tc-1',
      output: { id: '1:5', type: 'RECTANGLE' },
      providerExecuted: true
    }])
  })

  test('tool_call_update failed emits tool-output-error', () => {
    const update: SessionUpdate = {
      sessionUpdate: 'tool_call_update',
      toolCallId: 'tc-1',
      status: 'failed',
      content: [{ type: 'content', content: { type: 'text', text: 'Node not found' } }]
    }
    const result = mapUpdate(update, TEXT_ID, false)
    expect(result.chunks).toEqual([{
      type: 'tool-output-error',
      toolCallId: 'tc-1',
      errorText: 'Node not found',
      providerExecuted: true
    }])
  })

  test('unhandled update type produces no chunks', () => {
    const update = {
      sessionUpdate: 'available_commands_update',
      availableCommands: []
    } as unknown as SessionUpdate
    const result = mapUpdate(update, TEXT_ID, false)
    expect(result.chunks).toEqual([])
    expect(result.textStarted).toBe(false)
  })
})
