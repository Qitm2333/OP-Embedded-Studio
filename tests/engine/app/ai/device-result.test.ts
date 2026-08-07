import { describe, expect, test } from 'bun:test'

import type { ChatTransport, UIMessage } from 'ai'
import { computed, ref } from 'vue'

import type { AIProviderID } from '@open-pencil/core/constants'

import type { AIChatMode } from '@/app/ai/chat/storage'
import { createChatSessionManager } from '@/app/ai/chat/transports'
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
  test('can create a local Device chat without an AI provider', async () => {
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
      chatMode: ref<AIChatMode>('device'),
      getActiveEditorStore: () => store
    })

    expect(await manager.ensureChat()).toBeNull()
    expect(await manager.ensureChat(true)).not.toBeNull()
  })

  test('appends one deterministic result to Device chat and preserves it across mode switches', async () => {
    const store = {} as EditorStore
    const chatMode = ref<AIChatMode>('device')
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
      chatMode,
      getActiveEditorStore: () => store
    })
    manager.setOverrideTransport(() => transport)

    const deviceChat = await manager.ensureChat()
    expect(deviceChat).not.toBeNull()
    manager.appendLocalDeviceResult('烧录完成。', 'plan-1:success')
    manager.appendLocalDeviceResult('不应重复。', 'plan-1:success')
    expect(deviceChat?.messages).toHaveLength(1)
    expect(deviceChat?.messages[0]?.parts).toEqual([{ type: 'text', text: '烧录完成。' }])

    chatMode.value = 'design'
    await manager.ensureChat()
    manager.appendLocalDeviceResult('第二次烧录完成。', 'plan-2:success')
    chatMode.value = 'device'
    const restoredDeviceChat = await manager.ensureChat()

    expect(restoredDeviceChat?.messages).toHaveLength(2)
    expect(restoredDeviceChat?.messages[1]?.parts).toEqual([
      { type: 'text', text: '第二次烧录完成。' }
    ])
  })
})
