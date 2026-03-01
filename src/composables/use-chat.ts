import { Chat } from '@ai-sdk/vue'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { DirectChatTransport, ToolLoopAgent } from 'ai'
import dedent from 'dedent'
import { computed, ref, watch } from 'vue'

import type { UIMessage } from 'ai'

const API_KEY_STORAGE = 'open-pencil:openrouter-api-key'
const MODEL_STORAGE = 'open-pencil:model'

export interface ModelOption {
  id: string
  name: string
  provider: string
  tag?: string
}

export const MODELS: ModelOption[] = [
  // Frontier
  {
    id: 'anthropic/claude-sonnet-4.6',
    name: 'Claude Sonnet 4.6',
    provider: 'Anthropic',
    tag: 'Recommended'
  },
  {
    id: 'anthropic/claude-opus-4.6',
    name: 'Claude Opus 4.6',
    provider: 'Anthropic',
    tag: 'Smartest'
  },
  {
    id: 'google/gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    provider: 'Google',
    tag: '1M context'
  },
  { id: 'openai/gpt-5.3-codex', name: 'GPT-5.3 Codex', provider: 'OpenAI' },

  // Fast & cheap
  { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'Google', tag: 'Fast' },
  { id: 'qwen/qwen3.5-flash-02-23', name: 'Qwen 3.5 Flash', provider: 'Qwen', tag: 'Cheap' },
  { id: 'deepseek/deepseek-v3.2', name: 'DeepSeek V3.2', provider: 'DeepSeek', tag: 'Cheap' },

  // Free
  { id: 'qwen/qwen3-coder:free', name: 'Qwen3 Coder', provider: 'Qwen', tag: 'Free' },
  { id: 'openai/gpt-oss-120b:free', name: 'GPT-OSS 120B', provider: 'OpenAI', tag: 'Free' }
]

export const DEFAULT_MODEL = MODELS[0].id

const SYSTEM_PROMPT = dedent`
  You are a design assistant inside OpenPencil, a Figma-like design editor.
  Help users create and modify designs. Be concise and direct.
  When describing changes, use specific design terminology.
`

const apiKey = ref(localStorage.getItem(API_KEY_STORAGE) ?? '')
const modelId = ref(localStorage.getItem(MODEL_STORAGE) ?? DEFAULT_MODEL)
const activeTab = ref<'design' | 'ai'>('design')

watch(apiKey, (key) => {
  if (key) {
    localStorage.setItem(API_KEY_STORAGE, key)
  } else {
    localStorage.removeItem(API_KEY_STORAGE)
  }
})

watch(modelId, (id) => {
  localStorage.setItem(MODEL_STORAGE, id)
})

const isConfigured = computed(() => apiKey.value.length > 0)

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only mock transports don't implement full generics
let overrideTransport: (() => any) | null = null

let chat: Chat<UIMessage> | null = null

function createTransport() {
  if (overrideTransport) return overrideTransport()

  const openrouter = createOpenRouter({
    apiKey: apiKey.value,
    headers: {
      'X-OpenRouter-Title': 'OpenPencil',
      'HTTP-Referer': 'https://github.com/dannote/open-pencil'
    }
  })

  const agent = new ToolLoopAgent({
    model: openrouter(modelId.value),
    instructions: SYSTEM_PROMPT
  })

  return new DirectChatTransport({ agent })
}

function ensureChat(): Chat<UIMessage> | null {
  if (!apiKey.value) return null
  if (!chat) {
    chat = new Chat<UIMessage>({
      transport: createTransport()
    })
  }
  return chat
}

function resetChat() {
  chat = null
}

if (typeof window !== 'undefined') {
  window.__OPEN_PENCIL_SET_TRANSPORT__ = (factory) => {
    overrideTransport = factory
  }
}

export function useAIChat() {
  return {
    apiKey,
    modelId,
    activeTab,
    isConfigured,
    ensureChat,
    resetChat
  }
}
