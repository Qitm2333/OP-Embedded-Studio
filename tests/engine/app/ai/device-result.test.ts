import { describe, expect, test } from 'bun:test'

import type { ChatTransport, UIMessage } from 'ai'
import { computed, ref } from 'vue'

import type { AIProviderID } from '@open-pencil/core/constants'

import { createChatSessionManager, createUnifiedAITools } from '@/app/ai/chat/transports'
import type { EditorStore } from '@/app/editor/active-store'

const transport: ChatTransport<UIMessage> = {
  async sendMessages() {
    return new ReadableStream()
  },
  async reconnectToStream() {
    return null
  }
}

describe('device execution result replies', () => {
  test('unified tools expose canvas and deployment actions together', () => {
    const tools = createUnifiedAITools({} as EditorStore)

    expect(tools.render).toBeDefined()
    expect(tools.prepare_usb_frame_deployment).toBeDefined()
    expect(tools.prepare_usb_prototype_deployment).toBeDefined()
  })

  test('can create a local deployment chat without an AI provider', async () => {
    const store = {} as EditorStore
    const manager = createChatSessionManager({
      isConfigured: computed(() => false),
      isACPProvider: computed(() => false),
      providerID: ref<AIProviderID>('openrouter'),
      apiKey: ref(''),
      modelID: ref(''),
      customModelID: ref(''),
      customBaseURL: ref(''),
      customAPIType: ref<'completions' | 'responses'>('completions'),
      maxOutputTokens: ref(1024),
      getActiveEditorStore: () => store
    })

    expect(await manager.ensureChat()).toBeNull()
    expect(await manager.ensureChat(true)).not.toBeNull()
  })

  test('appends one deterministic result and preserves it in the unified document history', async () => {
    const firstStore = {} as EditorStore
    const secondStore = {} as EditorStore
    let activeStore = firstStore
    const manager = createChatSessionManager({
      isConfigured: computed(() => true),
      isACPProvider: computed(() => false),
      providerID: ref<AIProviderID>('openrouter'),
      apiKey: ref('test-key'),
      modelID: ref('test-model'),
      customModelID: ref(''),
      customBaseURL: ref(''),
      customAPIType: ref<'completions' | 'responses'>('completions'),
      maxOutputTokens: ref(1024),
      getActiveEditorStore: () => activeStore
    })
    manager.setOverrideTransport(() => transport)

    const unifiedChat = await manager.ensureChat()
    expect(unifiedChat).not.toBeNull()
    manager.appendLocalDeviceResult('烧录完成。', 'plan-1:success')
    manager.appendLocalDeviceResult('不应重复。', 'plan-1:success')
    expect(unifiedChat?.messages).toHaveLength(1)
    expect(unifiedChat?.messages[0]?.parts).toEqual([{ type: 'text', text: '烧录完成。' }])

    manager.markTransportDirty()
    const rebuiltChat = await manager.ensureChat()
    expect(rebuiltChat?.messages).toHaveLength(1)

    activeStore = secondStore
    await manager.ensureChat()
    activeStore = firstStore
    const restoredChat = await manager.ensureChat()

    expect(restoredChat?.messages).toHaveLength(1)
    expect(restoredChat?.messages[0]?.parts).toEqual([{ type: 'text', text: '烧录完成。' }])
  })
})
