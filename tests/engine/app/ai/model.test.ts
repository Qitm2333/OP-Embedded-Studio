import { describe, expect, test } from 'bun:test'

import {
  modelSupportsImageInput,
  providerRequiresCustomModelID,
  resolveLanguageModelID
} from '@/app/ai/chat/model'
import { normalizeOpenRouterModel } from '@/app/ai/chat/provider-models'

describe('resolveLanguageModelID', () => {
  test('uses the selected OpenRouter model when no custom model is configured', () => {
    expect(
      resolveLanguageModelID({
        providerID: 'openrouter',
        modelID: 'anthropic/claude-sonnet-4.6',
        customModelID: ''
      })
    ).toBe('anthropic/claude-sonnet-4.6')
  })

  test('uses a custom OpenRouter model ID when provided', () => {
    expect(
      resolveLanguageModelID({
        providerID: 'openrouter',
        modelID: 'anthropic/claude-sonnet-4.6',
        customModelID: '  meta-llama/llama-3.3-70b-instruct  '
      })
    ).toBe('meta-llama/llama-3.3-70b-instruct')
  })
})

describe('providerRequiresCustomModelID', () => {
  test('lets OpenRouter use the selected model when the custom model field is empty', () => {
    expect(providerRequiresCustomModelID('openrouter', { supportsCustomModel: true })).toBe(false)
  })

  test('requires custom model IDs for compatible providers without curated model lists', () => {
    expect(providerRequiresCustomModelID('openai-compatible', { supportsCustomModel: true })).toBe(
      true
    )
    expect(
      providerRequiresCustomModelID('anthropic-compatible', { supportsCustomModel: true })
    ).toBe(true)
  })

  test('does not require a custom model for fixed-model providers', () => {
    expect(providerRequiresCustomModelID('anthropic', {})).toBe(false)
  })
})

describe('normalizeOpenRouterModel', () => {
  test('keeps tool-capable OpenRouter models', () => {
    expect(
      normalizeOpenRouterModel({
        id: 'meta-llama/llama-3.3-70b-instruct',
        name: 'Llama 3.3 70B Instruct',
        supported_parameters: ['tools']
      })
    ).toEqual({ id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct' })
  })

  test('skips OpenRouter models without tool support', () => {
    expect(
      normalizeOpenRouterModel({
        id: 'text-only/model',
        name: 'Text Only',
        supported_parameters: []
      })
    ).toBeNull()
  })
})

describe('modelSupportsImageInput', () => {
  const config = { modelID: 'model', customModelID: '' }

  test('enables image input for established multimodal providers and ACP negotiation', () => {
    expect(modelSupportsImageInput({ ...config, providerID: 'openai' })).toBe(true)
    expect(modelSupportsImageInput({ ...config, providerID: 'anthropic' })).toBe(true)
    expect(modelSupportsImageInput({ ...config, providerID: 'google' })).toBe(true)
    expect(modelSupportsImageInput({ ...config, providerID: 'openrouter' })).toBe(true)
    expect(modelSupportsImageInput({ ...config, providerID: 'acp:claude-code' })).toBe(true)
  })

  test('does not claim image input for text-focused provider integrations', () => {
    expect(modelSupportsImageInput({ ...config, providerID: 'deepseek' })).toBe(false)
    expect(modelSupportsImageInput({ ...config, providerID: 'zai' })).toBe(false)
    expect(modelSupportsImageInput({ ...config, providerID: 'minimax' })).toBe(false)
  })
})
