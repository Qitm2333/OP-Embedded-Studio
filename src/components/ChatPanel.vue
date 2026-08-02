<script setup lang="ts">
import { ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from 'reka-ui'
import { refAutoReset } from '@vueuse/core'
import { isReasoningUIPart, isTextUIPart, isToolUIPart } from 'ai'
import { computed, markRaw, nextTick, ref, watch } from 'vue'

import { getAcpDebugText, clearAcpDebugLog, hasAcpDebugEntries } from '@/app/ai/acp/transport'
import { describeAIError } from '@/app/ai/chat/errors'
import { isDirectUsbFrameDeploymentRequest } from '@/app/ai/device/tools'
import { copyChatLog } from '@/app/ai/debug'
import { clearToolLogEntries, didHitStepLimit } from '@/app/ai/tools'
import { activeTab } from '@/app/tabs'
import AcpPermissionDialog from '@/components/chat/AcpPermissionDialog.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import ChatMessage from '@/components/chat/ChatMessage.vue'
import AppTextButton from '@/components/ui/AppTextButton.vue'
import ProviderSetup from '@/components/chat/ProviderSetup.vue'
import { useAIChat } from '@/app/ai/chat/use'
import { toast } from '@/app/shell/ui'
import { useI18n } from '@open-pencil/vue'
import { getDevicePrototypeFrameCandidates } from '@/app/editor/device-prototype'
import { useEditorStore } from '@/app/editor/active-store'
import { getActiveEmbeddedDisplayProfile } from '@/features/embedded-display'

import type { Chat } from '@ai-sdk/vue'
import type { FileUIPart, UIMessage } from 'ai'

const IS_DEV = import.meta.env.DEV

const { isConfigured, ensureChat, submitLocalDeviceAction, resetChat, chatMode } = useAIChat()
const { dialogs } = useI18n()
const editorStore = useEditorStore()

const chat = ref<Chat<UIMessage> | null>(null)

void ensureChat()
  .then((c) => {
    if (c) chat.value = markRaw(c)
    return undefined
  })
  .catch((error: unknown) => {
    toast.error(error instanceof Error ? error.message : 'Failed to initialize chat')
  })
const messagesEnd = ref<HTMLDivElement>()
const followsLatestMessage = ref(true)
const localActionPending = ref(false)
const debugCopied = refAutoReset(false, 1500)
const acpLogCopied = refAutoReset(false, 1500)

const messages = computed(() => chat.value?.messages ?? [])
const compatiblePrototypeFrames = computed(() => {
  void editorStore.state.sceneVersion
  const profile = getActiveEmbeddedDisplayProfile()
  return getDevicePrototypeFrameCandidates(editorStore).filter(
    (frame) =>
      frame.width === profile.resolution.width && frame.height === profile.resolution.height
  )
})
const canCreatePrototype = computed(
  () => compatiblePrototypeFrames.value.length >= 2 && compatiblePrototypeFrames.value.length <= 10
)
const status = computed(() =>
  localActionPending.value ? 'submitted' : (chat.value?.status ?? 'ready')
)
const chatError = computed(() => {
  const error = chat.value?.error
  return error ? describeAIError(error) : null
})
const activeAssistantId = computed(() => {
  if (status.value !== 'submitted' && status.value !== 'streaming') return undefined
  return [...messages.value].reverse().find((message) => message.role === 'assistant')?.id
})
const isThinking = computed(() => {
  if (status.value === 'submitted') return true
  if (status.value !== 'streaming') return false
  const activeId = activeAssistantId.value
  const assistant = activeId ? messages.value.find((message) => message.id === activeId) : undefined
  if (!assistant) return true
  return !assistant.parts.some(
    (part) =>
      (isTextUIPart(part) && part.text.trim().length > 0) ||
      (isReasoningUIPart(part) && part.text.trim().length > 0) ||
      isToolUIPart(part)
  )
})

const showContinue = computed(() => {
  if (status.value !== 'ready') return false
  if (messages.value.length === 0) return false
  const last = messages.value[messages.value.length - 1]
  return last.role === 'assistant' && didHitStepLimit()
})

function scrollToBottom(force = false) {
  if (!force && !followsLatestMessage.value) return
  nextTick(() => {
    messagesEnd.value?.scrollIntoView({ behavior: 'auto', block: 'end' })
  })
}

function handleViewportScroll(event: Event) {
  const viewport = event.currentTarget as HTMLElement
  const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
  followsLatestMessage.value = distanceFromBottom <= 48
}

watch(messages, () => scrollToBottom(), { deep: true })
watch(status, (nextStatus, previousStatus) => {
  if (previousStatus !== nextStatus && (nextStatus === 'ready' || nextStatus === 'error')) {
    scrollToBottom()
  }
})
watch([() => activeTab.value?.id, chatMode], async () => {
  const nextChat = await ensureChat()
  chat.value = nextChat ? markRaw(nextChat) : null
  followsLatestMessage.value = true
  scrollToBottom(true)
})

async function handleSubmit(text: string, files: FileUIPart[] = []) {
  if (status.value === 'streaming' || status.value === 'submitted') return
  followsLatestMessage.value = true
  try {
    if (
      files.length === 0 &&
      chatMode.value === 'device' &&
      isDirectUsbFrameDeploymentRequest(text)
    ) {
      localActionPending.value = true
      try {
        const localChat = await submitLocalDeviceAction(text)
        if (localChat) {
          chat.value = markRaw(localChat)
          scrollToBottom(true)
          return
        }
      } finally {
        localActionPending.value = false
      }
    }
    const c = await ensureChat()
    if (c) chat.value = markRaw(c)
  } catch (e) {
    console.error('Failed to initialize chat:', e)
    toast.error(e instanceof Error ? e.message : String(e))
    return
  }
  const activeChat = chat.value
  if (!activeChat) return
  const sendPromise = activeChat.sendMessage({ text, files })
  scrollToBottom(true)
  queueMicrotask(() => scrollToBottom(true))

  void sendPromise.catch((e: unknown) => {
    console.error('Chat error:', e)
    if (!chat.value?.error) toast.error(e instanceof Error ? e.message : String(e))
  })
}

function handleFrameQuickAction(): void {
  void handleSubmit('帮我烧录选中的界面')
}

function handlePrototypeQuickAction(): void {
  const frameCount = compatiblePrototypeFrames.value.length
  void handleSubmit(
    `请用当前页面这 ${frameCount} 个同尺寸 Frame 创建一个新的交互，并准备通过 USB 烧录。请根据界面名称和内容设计清晰、精简的跳转关系。`
  )
}

async function handleRetry() {
  if (!chat.value || status.value === 'streaming' || status.value === 'submitted') return
  followsLatestMessage.value = true
  chat.value.clearError()
  scrollToBottom(true)
  try {
    await chat.value.regenerate()
  } catch (error) {
    console.error('Chat retry failed:', error)
    if (!chat.value.error) toast.error(error instanceof Error ? error.message : String(error))
  }
}

function handleStop() {
  chat.value?.stop()
}

async function handleCopyDebug() {
  await copyChatLog(messages.value)
  debugCopied.value = true
}

async function handleCopyAcpLog() {
  const text = getAcpDebugText()
  if (!text) return
  await navigator.clipboard.writeText(text)
  acpLogCopied.value = true
}

function handleClearChat() {
  chat.value = null
  resetChat()
  clearToolLogEntries()
  clearAcpDebugLog()
}
</script>

<template>
  <div data-test-id="chat-panel" class="flex min-w-0 flex-1 flex-col overflow-hidden select-text">
    <ProviderSetup v-if="!isConfigured" />

    <template v-else>
      <ScrollAreaRoot class="min-h-0 flex-1">
        <ScrollAreaViewport
          data-test-id="chat-scroll-viewport"
          class="h-full px-3 py-3 [&>div]:h-full"
          @scroll.passive="handleViewportScroll"
        >
          <!-- Empty state -->
          <div
            v-if="messages.length === 0"
            data-test-id="chat-empty-state"
            class="flex h-full flex-col items-center justify-center gap-3 text-muted"
          >
            <icon-lucide-cpu v-if="chatMode === 'device'" class="size-8 opacity-50" />
            <icon-lucide-message-circle v-else class="size-8 opacity-50" />
            <p class="text-center text-xs">
              {{
                chatMode === 'device'
                  ? dialogs.describeDeviceDeployment
                  : dialogs.describeCreateOrChange
              }}
            </p>
          </div>

          <!-- Messages -->
          <div v-else data-test-id="chat-messages" class="flex flex-col gap-3">
            <ChatMessage
              v-for="msg in messages"
              :key="msg.id"
              :message="msg"
              :active="msg.id === activeAssistantId"
            />

            <!-- Thinking indicator: shown when AI is working but no visible activity -->
            <div v-if="isThinking" data-test-id="chat-typing-indicator" class="flex gap-2">
              <div
                class="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/20 text-[10px] font-bold text-muted"
              >
                AI
              </div>
              <div class="flex items-center gap-1 py-2">
                <span
                  class="size-1.5 animate-bounce rounded-full bg-muted"
                  style="animation-delay: 0ms"
                />
                <span
                  class="size-1.5 animate-bounce rounded-full bg-muted"
                  style="animation-delay: 150ms"
                />
                <span
                  class="size-1.5 animate-bounce rounded-full bg-muted"
                  style="animation-delay: 300ms"
                />
              </div>
            </div>

            <!-- Continue button when step limit reached -->
            <div v-if="showContinue" class="flex justify-center py-2">
              <button
                class="flex items-center gap-1.5 rounded-full bg-accent/10 px-4 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
                @click="handleSubmit('Continue where you left off')"
              >
                <icon-lucide-play class="size-3" />
                Continue
              </button>
            </div>

            <div
              v-if="chatError"
              data-test-id="chat-error"
              class="border-l-2 border-red-500 bg-red-500/5 px-3 py-2.5"
            >
              <div class="flex min-w-0 items-start gap-2">
                <icon-lucide-circle-alert class="mt-0.5 size-4 shrink-0 text-red-400" />
                <div class="min-w-0 flex-1">
                  <p class="text-sm leading-5 font-medium text-surface">{{ chatError.title }}</p>
                  <p class="mt-0.5 text-xs leading-4 text-muted">{{ chatError.message }}</p>
                </div>
                <button
                  v-if="chatError.retryable"
                  data-test-id="chat-error-retry"
                  type="button"
                  class="flex h-7 shrink-0 items-center gap-1 border border-border px-2 text-xs text-surface transition-colors hover:bg-hover"
                  title="Retry the last response"
                  @click="handleRetry"
                >
                  <icon-lucide-rotate-cw class="size-3.5" />
                  Retry
                </button>
              </div>
              <details v-if="chatError.detail !== chatError.message" class="mt-2 pl-6">
                <summary class="cursor-pointer text-[11px] text-muted">Technical details</summary>
                <p class="mt-1 break-words text-[11px] leading-4 text-red-300/80">
                  {{ chatError.detail }}
                </p>
              </details>
            </div>

            <div ref="messagesEnd" />
          </div>
        </ScrollAreaViewport>
        <ScrollAreaScrollbar orientation="vertical" class="flex w-1.5 touch-none p-px select-none">
          <ScrollAreaThumb class="relative flex-1 rounded-full bg-muted/30" />
        </ScrollAreaScrollbar>
      </ScrollAreaRoot>

      <!-- Chat toolbar -->
      <div
        v-if="messages.length > 0"
        class="flex shrink-0 items-center gap-1 border-t border-border px-3 py-1"
      >
        <AppTextButton
          v-if="IS_DEV"
          :aria-label="debugCopied ? 'Chat log copied' : 'Copy chat log'"
          :title="debugCopied ? 'Chat log copied' : 'Copy chat log'"
          :ui="{ base: 'flex size-6 items-center justify-center rounded hover:bg-hover' }"
          @click="handleCopyDebug"
        >
          <icon-lucide-clipboard-copy v-if="!debugCopied" class="size-3" />
          <icon-lucide-check v-else class="size-3 text-green-400" />
          <span class="sr-only">{{ debugCopied ? 'Copied' : 'Copy chat log' }}</span>
        </AppTextButton>
        <AppTextButton
          v-if="IS_DEV && hasAcpDebugEntries()"
          :aria-label="acpLogCopied ? 'ACP log copied' : 'Copy ACP log'"
          :title="acpLogCopied ? 'ACP log copied' : 'Copy ACP log'"
          :ui="{ base: 'flex size-6 items-center justify-center rounded hover:bg-hover' }"
          @click="handleCopyAcpLog"
        >
          <icon-lucide-bug v-if="!acpLogCopied" class="size-3" />
          <icon-lucide-check v-else class="size-3 text-green-400" />
          <span class="sr-only">{{ acpLogCopied ? 'Copied' : 'Copy ACP log' }}</span>
        </AppTextButton>
        <AppTextButton
          aria-label="Clear chat"
          title="Clear chat"
          :ui="{ base: 'flex size-6 items-center justify-center rounded hover:bg-hover' }"
          @click="handleClearChat"
        >
          <icon-lucide-trash-2 class="size-3" />
          <span class="sr-only">Clear chat</span>
        </AppTextButton>
      </div>

      <div
        v-if="chatMode === 'device' && status !== 'streaming' && status !== 'submitted'"
        data-test-id="device-quick-actions"
        class="scrollbar-thin flex shrink-0 gap-1.5 overflow-x-auto px-3 pt-1.5 pb-1"
      >
        <button
          data-test-id="device-quick-deploy-frame"
          type="button"
          class="flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-border bg-panel-field px-2.5 text-[11px] text-surface shadow-sm hover:bg-panel-field-hover"
          @click="handleFrameQuickAction"
        >
          <icon-lucide-monitor-up class="size-3.5 text-accent" />
          烧录选中的界面
        </button>
        <button
          v-if="canCreatePrototype"
          data-test-id="device-quick-deploy-prototype"
          type="button"
          class="flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-border bg-panel-field px-2.5 text-[11px] text-surface shadow-sm hover:bg-panel-field-hover"
          @click="handlePrototypeQuickAction"
        >
          <icon-lucide-git-branch class="size-3.5 text-accent" />
          创建 {{ compatiblePrototypeFrames.length }} Frame 交互并烧录
        </button>
      </div>

      <ChatInput :status="status" @submit="handleSubmit" @stop="handleStop" />

      <AcpPermissionDialog />
    </template>
  </div>
</template>
