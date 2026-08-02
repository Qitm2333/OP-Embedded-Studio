import { Chat } from '@ai-sdk/vue'
import { DirectChatTransport, stepCountIs, ToolLoopAgent } from 'ai'
import type { ChatTransport, ModelMessage, UIMessage } from 'ai'
import type { ComputedRef, Ref } from 'vue'

import { ACP_AGENTS } from '@open-pencil/core/constants'
import type { ACPAgentID, AIProviderID } from '@open-pencil/core/constants'

import { compactDesignContext } from '@/app/ai/chat/design-context'
import { createLanguageModel, resolveLanguageModelID } from '@/app/ai/chat/model'
import type { AIChatMode } from '@/app/ai/chat/storage'
import { createSystemPrompt } from '@/app/ai/chat/system'
import { recordDesignHandoff } from '@/app/ai/device/memory'
import { createDeviceSystemPrompt } from '@/app/ai/device/system'
import {
  createDeviceTools,
  isDirectUsbFrameDeploymentRequest,
  prepareUsbFrameDeploymentOutput
} from '@/app/ai/device/tools'
import { createAITools, MAX_AGENT_STEPS, recordStepUsage, resetRunSteps } from '@/app/ai/tools'
import type { getActiveEditorStore } from '@/app/editor/active-store'
import {
  AI_CHAT_CHUNK_TIMEOUT_MS,
  AI_CHAT_STEP_TIMEOUT_MS,
  AI_CHAT_TOTAL_TIMEOUT_MS
} from '@/constants'

type EditorStore = ReturnType<typeof getActiveEditorStore>

type ChatSessionOptions = {
  isConfigured: ComputedRef<boolean>
  isACPProvider: ComputedRef<boolean>
  providerID: Ref<AIProviderID>
  apiKey: Ref<string>
  modelID: Ref<string>
  customModelID: Ref<string>
  customBaseURL: Ref<string>
  customAPIType: Ref<'completions' | 'responses'>
  maxOutputTokens: Ref<number>
  chatMode: Ref<AIChatMode>
  getActiveEditorStore: () => EditorStore
}

type ToolLoopTransportOptions = {
  store: EditorStore
  providerID: AIProviderID
  apiKey: string
  modelID: string
  customModelID: string
  customBaseURL: string
  customAPIType: 'completions' | 'responses'
  maxOutputTokens: number
  mode?: AIChatMode
}

const ANTHROPIC_CACHE_CONTROL = {
  anthropic: { cacheControl: { type: 'ephemeral' } }
} as const

const DEEPSEEK_THINKING_DISABLED = {
  deepseek: { thinking: { type: 'disabled' } }
} as const

const CHAT_TIMEOUT = {
  totalMs: AI_CHAT_TOTAL_TIMEOUT_MS,
  stepMs: AI_CHAT_STEP_TIMEOUT_MS,
  chunkMs: AI_CHAT_CHUNK_TIMEOUT_MS
} as const

function supportsAnthropicCaching(providerID: AIProviderID, modelID: string): boolean {
  return (
    providerID === 'anthropic' ||
    providerID === 'anthropic-compatible' ||
    (providerID === 'openrouter' && modelID.startsWith('anthropic/'))
  )
}

export function chatProviderOptions(providerID: AIProviderID, modelID: string) {
  if (providerID === 'deepseek') return DEEPSEEK_THINKING_DISABLED
  return supportsAnthropicCaching(providerID, modelID) ? ANTHROPIC_CACHE_CONTROL : undefined
}

export async function createACPTransport(
  providerID: AIProviderID,
  store?: EditorStore,
  mode: AIChatMode = 'design'
) {
  const agentId = providerID.replace('acp:', '') as ACPAgentID
  const agentDef = ACP_AGENTS.find((a) => a.id === agentId)
  if (!agentDef) throw new Error(`Unknown ACP agent: ${agentId}`)

  const { ACPChatTransport } = await import('@/app/ai/acp/transport')
  const { homeDir } = await import('@tauri-apps/api/path')
  return new ACPChatTransport({
    agentDef,
    cwd: await homeDir(),
    ...(mode === 'device' && store
      ? { getSystemPrompt: () => createDeviceSystemPrompt(store) }
      : {})
  })
}

function recordAgentUsage(
  usage: {
    inputTokens?: number
    outputTokens?: number
    inputTokenDetails: { cacheReadTokens?: number; cacheWriteTokens?: number }
  },
  store: EditorStore
): void {
  recordStepUsage(
    {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      cacheReadTokens: usage.inputTokenDetails.cacheReadTokens ?? 0,
      cacheWriteTokens: usage.inputTokenDetails.cacheWriteTokens ?? 0,
      timestamp: Date.now()
    },
    store
  )
}

export function prepareDesignStep(messages: ModelMessage[]) {
  return { messages: compactDesignContext(messages) }
}

function createDeviceToolLoopTransport({
  store,
  providerID,
  apiKey,
  modelID,
  customModelID,
  customBaseURL,
  customAPIType,
  maxOutputTokens
}: ToolLoopTransportOptions) {
  const effectiveModelID = resolveLanguageModelID({ providerID, modelID, customModelID })
  const providerOptions = chatProviderOptions(providerID, effectiveModelID)
  const agent = new ToolLoopAgent({
    model: createLanguageModel(
      {
        providerID,
        apiKey,
        modelID,
        customModelID,
        customBaseURL,
        customAPIType
      },
      { requestTimeoutMs: AI_CHAT_STEP_TIMEOUT_MS }
    ),
    instructions: createDeviceSystemPrompt(store),
    tools: createDeviceTools(store),
    stopWhen: stepCountIs(4),
    maxOutputTokens,
    timeout: CHAT_TIMEOUT,
    providerOptions,
    prepareCall: (options) => {
      resetRunSteps(store)
      return {
        ...options,
        instructions: createDeviceSystemPrompt(store),
        maxOutputTokens,
        providerOptions
      }
    },
    onStepFinish: ({ usage }) => recordAgentUsage(usage, store)
  })
  return new DirectChatTransport({ agent }) as ChatTransport<UIMessage>
}

export function createToolLoopTransport({
  store,
  providerID,
  apiKey,
  modelID,
  customModelID,
  customBaseURL,
  customAPIType,
  maxOutputTokens,
  mode = 'design'
}: ToolLoopTransportOptions) {
  if (mode === 'device') {
    return createDeviceToolLoopTransport({
      store,
      providerID,
      apiKey,
      modelID,
      customModelID,
      customBaseURL,
      customAPIType,
      maxOutputTokens,
      mode
    })
  }
  const tools = createAITools(store, {
    onRenderSuccess: ({ id, name }) => {
      recordDesignHandoff(store, {
        frameId: id,
        frameName: name,
        observation: 'Design AI rendered the current screen from complete JSX.',
        intent: 'Keep this Frame as the current design and device deployment source.',
        changes: ['Applied the latest complete Design JSX to the canvas.']
      })
    }
  })
  const effectiveModelID = resolveLanguageModelID({ providerID, modelID, customModelID })
  const providerOptions = chatProviderOptions(providerID, effectiveModelID)
  const agent = new ToolLoopAgent({
    model: createLanguageModel({
      providerID,
      apiKey,
      modelID,
      customModelID,
      customBaseURL,
      customAPIType
    }),
    instructions: createSystemPrompt(store),
    tools,
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
    maxOutputTokens,
    providerOptions,
    prepareStep: ({ messages }) => prepareDesignStep(messages),
    prepareCall: (options) => {
      resetRunSteps(store)
      return {
        ...options,
        instructions: createSystemPrompt(store),
        maxOutputTokens,
        providerOptions
      }
    },
    onStepFinish: ({ usage }) => {
      recordAgentUsage(usage, store)
    }
  })

  return new DirectChatTransport({ agent }) as ChatTransport<UIMessage>
}

export function createChatSessionManager({
  isConfigured,
  isACPProvider,
  providerID,
  apiKey,
  modelID,
  customModelID,
  customBaseURL,
  customAPIType,
  maxOutputTokens,
  chatMode,
  getActiveEditorStore
}: ChatSessionOptions) {
  let transportDirty = false
  let currentChatStore: EditorStore | null = null
  let currentChatMode: AIChatMode | null = null
  let currentChatMessages = new WeakMap<EditorStore, Partial<Record<AIChatMode, UIMessage[]>>>()
  let localDeviceResultKeys = new WeakMap<EditorStore, Set<string>>()
  let chat: Chat<UIMessage> | null = null
  let acpTransportInstance: { destroy(): Promise<void> } | null = null
  let overrideTransport: (() => ChatTransport<UIMessage>) | null = null

  function markTransportDirty() {
    transportDirty = true
    currentChatStore = null
    currentChatMode = null
    currentChatMessages = new WeakMap()
    localDeviceResultKeys = new WeakMap()
  }

  async function createActiveACPTransport(store: EditorStore) {
    await acpTransportInstance?.destroy()
    const transport = await createACPTransport(providerID.value, store, chatMode.value)
    acpTransportInstance = transport
    return transport as ChatTransport<UIMessage>
  }

  function createTransport(store: EditorStore) {
    if (overrideTransport) return overrideTransport()

    void acpTransportInstance?.destroy()
    acpTransportInstance = null

    return createToolLoopTransport({
      store,
      providerID: providerID.value,
      apiKey: apiKey.value,
      modelID: modelID.value,
      customModelID: customModelID.value,
      customBaseURL: customBaseURL.value,
      customAPIType: customAPIType.value,
      maxOutputTokens: maxOutputTokens.value,
      mode: chatMode.value
    })
  }

  async function ensureChat(): Promise<Chat<UIMessage> | null> {
    if (!isConfigured.value) return null

    const store = getActiveEditorStore()
    if (currentChatStore && currentChatMode && chat) {
      const histories = currentChatMessages.get(currentChatStore) ?? {}
      histories[currentChatMode] = chat.messages
      currentChatMessages.set(currentChatStore, histories)
    }

    if (
      !chat ||
      transportDirty ||
      currentChatStore !== store ||
      currentChatMode !== chatMode.value
    ) {
      const messages = currentChatMessages.get(store)?.[chatMode.value]
      const transport: ChatTransport<UIMessage> = isACPProvider.value
        ? await createActiveACPTransport(store)
        : createTransport(store)
      chat = new Chat<UIMessage>({ transport, messages })
      currentChatStore = store
      currentChatMode = chatMode.value
      transportDirty = false
    }
    return chat
  }

  async function submitLocalDeviceAction(text: string): Promise<Chat<UIMessage> | null> {
    if (chatMode.value !== 'device' || !isDirectUsbFrameDeploymentRequest(text)) return null

    const activeChat = await ensureChat()
    if (!activeChat) return null
    activeChat.clearError()

    const toolCallId = activeChat.generateId()
    activeChat.messages = [
      ...activeChat.messages,
      {
        id: activeChat.generateId(),
        role: 'user',
        parts: [{ type: 'text', text }]
      }
    ]

    const input = { intent: text, backgroundColor: '#000000' }
    try {
      const output = await prepareUsbFrameDeploymentOutput(
        getActiveEditorStore(),
        input.intent,
        input.backgroundColor
      )
      activeChat.messages = [
        ...activeChat.messages,
        {
          id: activeChat.generateId(),
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'prepare_usb_frame_deployment',
              toolCallId,
              state: 'output-available',
              input,
              output
            },
            { type: 'text', text: '部署参数已准备好，请检查确认卡后执行。' }
          ]
        }
      ]
    } catch (error) {
      activeChat.messages = [
        ...activeChat.messages,
        {
          id: activeChat.generateId(),
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'prepare_usb_frame_deployment',
              toolCallId,
              state: 'output-error',
              input,
              errorText: error instanceof Error ? error.message : String(error)
            }
          ]
        }
      ]
    }
    return activeChat
  }

  function appendLocalDeviceResult(text: string, resultKey: string): void {
    const normalizedText = text.trim()
    if (!normalizedText || !resultKey) return
    const store = getActiveEditorStore()
    const reportedKeys = localDeviceResultKeys.get(store) ?? new Set<string>()
    if (reportedKeys.has(resultKey)) return
    reportedKeys.add(resultKey)
    localDeviceResultKeys.set(store, reportedKeys)

    const message: UIMessage = {
      id:
        currentChatStore === store && currentChatMode === 'device' && chat
          ? chat.generateId()
          : globalThis.crypto.randomUUID(),
      role: 'assistant',
      parts: [{ type: 'text', text: normalizedText }]
    }
    if (currentChatStore === store && currentChatMode === 'device' && chat) {
      chat.messages = [...chat.messages, message]
      return
    }

    const histories = currentChatMessages.get(store) ?? {}
    histories.device = [...(histories.device ?? []), message]
    currentChatMessages.set(store, histories)
  }

  function resetChat() {
    if (currentChatStore) {
      const histories = currentChatMessages.get(currentChatStore)
      if (histories) {
        currentChatMessages.set(currentChatStore, {
          ...histories,
          [chatMode.value]: undefined
        })
      }
    }
    chat = null
    currentChatStore = null
    currentChatMode = null
    transportDirty = false
  }

  function setOverrideTransport(factory: (() => ChatTransport<UIMessage>) | null) {
    overrideTransport = factory
    markTransportDirty()
  }

  return {
    ensureChat,
    submitLocalDeviceAction,
    appendLocalDeviceResult,
    resetChat,
    markTransportDirty,
    setOverrideTransport
  }
}
