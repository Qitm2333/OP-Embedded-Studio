import { Chat } from '@ai-sdk/vue'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { DirectChatTransport, ToolLoopAgent } from 'ai'
import { computed, ref, watch } from 'vue'

import type { InferAgentUIMessage } from 'ai'

const API_KEY_STORAGE = 'open-pencil:openrouter-api-key'

const apiKey = ref(localStorage.getItem(API_KEY_STORAGE) ?? '')
const chatPanelOpen = ref(false)

watch(apiKey, (key) => {
  if (key) {
    localStorage.setItem(API_KEY_STORAGE, key)
  } else {
    localStorage.removeItem(API_KEY_STORAGE)
  }
})

const isConfigured = computed(() => apiKey.value.length > 0)

function createAgent() {
  const openrouter = createOpenRouter({ apiKey: apiKey.value })

  return new ToolLoopAgent({
    model: openrouter('anthropic/claude-sonnet-4'),
    instructions:
      'You are a design assistant inside OpenPencil, a Figma-like design editor. ' +
      'Help users create and modify designs. Be concise and direct.'
  })
}

type DesignAgent = ReturnType<typeof createAgent>
export type DesignMessage = InferAgentUIMessage<DesignAgent>

function createChat() {
  if (!apiKey.value) return null

  const agent = createAgent()

  return new Chat<DesignMessage>({
    transport: new DirectChatTransport({ agent })
  })
}

export function useAIChat() {
  return {
    apiKey,
    chatPanelOpen,
    isConfigured,
    createChat
  }
}
