import { Chat } from '@ai-sdk/vue'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { DirectChatTransport, ToolLoopAgent } from 'ai'
import { computed, ref, watch } from 'vue'

import type { InferAgentUIMessage } from 'ai'

const API_KEY_STORAGE = 'open-pencil:openrouter-api-key'
const MODEL_STORAGE = 'open-pencil:model'

export interface ModelOption {
  id: string
  name: string
  provider: string
  tag?: string
}

export const MODEL_OPTIONS: ModelOption[] = [
  // Design-optimized (vision + tool calling + strong spatial reasoning)
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

  // Fast & cheap
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'Anthropic' },
  {
    id: 'google/gemini-2.5-flash-preview-05-20',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    tag: 'Fast'
  },
  { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'OpenAI', tag: 'Cheap' },

  // Open source
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

// Deduplicate by id, keeping first occurrence
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

function createAgent() {
  const openrouter = createOpenRouter({
    apiKey: apiKey.value,
    headers: {
      'X-OpenRouter-Title': 'OpenPencil',
      'HTTP-Referer': 'https://github.com/dannote/open-pencil'
    }
  })

  return new ToolLoopAgent({
    model: openrouter(modelId.value),
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
    modelId,
    activeTab,
    isConfigured,
    createChat
  }
}
