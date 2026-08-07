import { Chat } from '@ai-sdk/vue'
import { DirectChatTransport, stepCountIs, ToolLoopAgent } from 'ai'
import type { ChatTransport, ModelMessage, UIMessage } from 'ai'
import type { ComputedRef, Ref } from 'vue'

import { ACP_AGENTS } from '@open-pencil/core/constants'
import type { ACPAgentID, AIProviderID } from '@open-pencil/core/constants'

import { compactDesignContext } from '@/app/ai/chat/design-context'
import { createLanguageModel, resolveLanguageModelID } from '@/app/ai/chat/model'
import { createUnifiedSystemPrompt } from '@/app/ai/chat/system'
import { recordDesignHandoff } from '@/app/ai/device/memory'
import type { PrepareDevicePrototypeProposalInput } from '@/app/ai/device/prototype'
import {
  createDeviceTools,
  prepareUsbFrameDeploymentOutput,
  resolveEmbeddedImagePlacement,
  prepareUsbPrototypeDeploymentOutput
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

export async function createACPTransport(providerID: AIProviderID, store?: EditorStore) {
  const agentId = providerID.replace('acp:', '') as ACPAgentID
  const agentDef = ACP_AGENTS.find((a) => a.id === agentId)
  if (!agentDef) throw new Error(`Unknown ACP agent: ${agentId}`)

  const { ACPChatTransport } = await import('@/app/ai/acp/transport')
  const { homeDir } = await import('@tauri-apps/api/path')
  return new ACPChatTransport({
    agentDef,
    cwd: await homeDir(),
    ...(store ? { getSystemPrompt: () => createUnifiedSystemPrompt(store) } : {})
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

export function createUnifiedAITools(store: EditorStore) {
  const designTools = createAITools(store, {
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
  return { ...designTools, ...createDeviceTools(store) }
}

export function createToolLoopTransport({
  store,
  providerID,
  apiKey,
  modelID,
  customModelID,
  customBaseURL,
  customAPIType,
  maxOutputTokens
}: ToolLoopTransportOptions) {
  const tools = createUnifiedAITools(store)
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
    instructions: createUnifiedSystemPrompt(store),
    tools,
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
    maxOutputTokens,
    timeout: CHAT_TIMEOUT,
    providerOptions,
    prepareStep: ({ messages }) => prepareDesignStep(messages),
    prepareCall: (options) => {
      resetRunSteps(store)
      return {
        ...options,
        instructions: createUnifiedSystemPrompt(store),
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
  getActiveEditorStore
}: ChatSessionOptions) {
  let transportDirty = false
  let currentChatStore: EditorStore | null = null
  const currentChatMessages = new WeakMap<EditorStore, UIMessage[]>()
  const localDeviceResultKeys = new WeakMap<EditorStore, Set<string>>()
  let chat: Chat<UIMessage> | null = null
  let acpTransportInstance: { destroy(): Promise<void> } | null = null
  let overrideTransport: (() => ChatTransport<UIMessage>) | null = null

  function markTransportDirty() {
    if (currentChatStore && chat) {
      currentChatMessages.set(currentChatStore, chat.messages)
    }
    transportDirty = true
    currentChatStore = null
  }

  async function createActiveACPTransport(store: EditorStore) {
    await acpTransportInstance?.destroy()
    const transport = await createACPTransport(providerID.value, store)
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
      maxOutputTokens: maxOutputTokens.value
    })
  }

  const localDeviceTransport: ChatTransport<UIMessage> = {
    async sendMessages() {
      return new ReadableStream()
    },
    async reconnectToStream() {
      return null
    }
  }

  async function ensureChat(allowUnconfiguredLocal = false): Promise<Chat<UIMessage> | null> {
    const store = getActiveEditorStore()
    const hasCurrentLocalChat = !isConfigured.value && currentChatStore === store && !!chat
    if (!isConfigured.value && !allowUnconfiguredLocal && !hasCurrentLocalChat) return null

    if (currentChatStore && chat) {
      currentChatMessages.set(currentChatStore, chat.messages)
    }

    if (!chat || transportDirty || currentChatStore !== store) {
      const messages = currentChatMessages.get(store)
      let transport: ChatTransport<UIMessage>
      if (!isConfigured.value) transport = localDeviceTransport
      else if (isACPProvider.value) transport = await createActiveACPTransport(store)
      else transport = createTransport(store)
      chat = new Chat<UIMessage>({ transport, messages })
      currentChatStore = store
      transportDirty = false
    }
    return chat
  }

  async function submitLocalDeviceToolAction(
    text: string,
    toolName: 'prepare_usb_frame_deployment' | 'prepare_usb_prototype_deployment',
    input: unknown,
    prepare: () => Promise<unknown>,
    successText: string
  ): Promise<Chat<UIMessage> | null> {
    const activeChat = await ensureChat(true)
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

    try {
      const output = await prepare()
      activeChat.messages = [
        ...activeChat.messages,
        {
          id: activeChat.generateId(),
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName,
              toolCallId,
              state: 'output-available',
              input,
              output
            },
            { type: 'text', text: successText }
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
              toolName,
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

  async function submitLocalDeviceAction(text: string): Promise<Chat<UIMessage> | null> {
    const input = { intent: text, placement: resolveEmbeddedImagePlacement(text) }
    return submitLocalDeviceToolAction(
      text,
      'prepare_usb_frame_deployment',
      input,
      () =>
        prepareUsbFrameDeploymentOutput(
          getActiveEditorStore(),
          input.intent,
          undefined,
          input.placement
        ),
      '部署参数已准备好，请检查确认卡后执行。'
    )
  }

  async function submitLocalDevicePrototypeAction(
    text: string,
    input: PrepareDevicePrototypeProposalInput
  ): Promise<Chat<UIMessage> | null> {
    return submitLocalDeviceToolAction(
      text,
      'prepare_usb_prototype_deployment',
      input,
      async () => prepareUsbPrototypeDeploymentOutput(getActiveEditorStore(), input),
      '交互方案已准备好，请检查确认卡后创建并烧录。'
    )
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
      id: currentChatStore === store && chat ? chat.generateId() : globalThis.crypto.randomUUID(),
      role: 'assistant',
      parts: [{ type: 'text', text: normalizedText }]
    }
    if (currentChatStore === store && chat) {
      chat.messages = [...chat.messages, message]
      return
    }

    currentChatMessages.set(store, [...(currentChatMessages.get(store) ?? []), message])
  }

  function resetChat() {
    if (currentChatStore) {
      currentChatMessages.delete(currentChatStore)
      localDeviceResultKeys.delete(currentChatStore)
    }
    chat = null
    currentChatStore = null
    transportDirty = false
  }

  function setOverrideTransport(factory: (() => ChatTransport<UIMessage>) | null) {
    overrideTransport = factory
    markTransportDirty()
  }

  return {
    ensureChat,
    submitLocalDeviceAction,
    submitLocalDevicePrototypeAction,
    appendLocalDeviceResult,
    resetChat,
    markTransportDirty,
    setOverrideTransport
  }
}
