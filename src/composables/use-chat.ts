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

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'Anthropic',
    tag: 'Recommended'
  },
  { id: 'anthropic/claude-opus-4', name: 'Claude Opus 4', provider: 'Anthropic', tag: 'Smartest' },
  {
    id: 'google/gemini-2.5-pro-preview-06-05',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    tag: 'Long context'
  },
  { id: 'openai/gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI' },
  {
    id: 'google/gemini-2.5-flash-preview-05-20',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    tag: 'Fast'
  },
  { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'OpenAI', tag: 'Cheap' },
  {
    id: 'deepseek/deepseek-chat-v3-0324:free',
    name: 'DeepSeek V3',
    provider: 'DeepSeek',
    tag: 'Free'
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B',
    provider: 'Meta',
    tag: 'Free'
  }
]

const seen = new Set<string>()
const deduped: ModelOption[] = []
for (const m of MODEL_OPTIONS) {
  if (!seen.has(m.id)) {
    seen.add(m.id)
    deduped.push(m)
  }
}
export const MODELS = deduped
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
