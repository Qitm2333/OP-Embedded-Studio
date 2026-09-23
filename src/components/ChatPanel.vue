<script setup lang="ts">
import { ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from 'reka-ui'
import { refAutoReset, useClipboard } from '@vueuse/core'
import { computed, markRaw, nextTick, ref, watch } from 'vue'

import { getACPDebugText, clearACPDebugLog, hasACPDebugEntries } from '@/app/ai/acp/transport'
import { copyChatLog } from '@/app/ai/debug'
import {
  analyzeAttachedImages,
  designMessageWithImageFindings
} from '@/app/ai/attachment/image/analyze'
import {
  createImagePreviewURL,
  isImageAttachmentMediaType,
  prepareImageAttachment,
  revokeImagePreviewURL
} from '@/app/ai/attachment/image/prepare'
import {
  clearImageAttachmentPresentations,
  setImageAttachmentPresentations
} from '@/app/ai/attachment/image/presentation'
import type { ImageAttachmentDraft } from '@/app/ai/attachment/image/types'
import { clearToolLogEntries, didHitStepLimit } from '@/app/ai/tools'
import { activeTab } from '@/app/tabs'
import { getActiveEditorStore, useEditorStore } from '@/app/editor/active-store'
import {
  getDevicePrototypeFrameCandidates,
  getSelectedDevicePrototypeFrameCandidates
} from '@/app/editor/device-prototype'
import { getActiveEmbeddedDisplayProfile } from '@/features/embedded-display'
import { defaultManualSettingsForProfile } from '@/features/device-prototype/model/rules'
import ACPPermissionDialog from '@/components/chat/ACPPermissionDialog.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import ChatMessage from '@/components/chat/ChatMessage.vue'
import DeviceQuickActions from '@/components/chat/DeviceQuickActions.vue'
import AppPlaceholder from '@/components/ui/AppPlaceholder.vue'
import AppTextButton from '@/components/ui/AppTextButton.vue'
import ProviderSetup from '@/components/chat/ProviderSetup.vue'
import { useAIChat } from '@/app/ai/chat/use'
import { toast } from '@/app/shell/ui'
import { useI18n } from '@open-pencil/vue'

import { useNotificationMessages } from '@/app/i18n/notifications'

import type { Chat } from '@ai-sdk/vue'
import type { UIMessage } from 'ai'
import type { JSONObject } from '@open-pencil/scene-graph/primitives'

const IS_DEV = import.meta.env.DEV

const {
  isConfigured,
  ensureChat,
  submitLocalDeviceAction,
  submitLocalDevicePrototypeAction,
  activeTab: activePropertiesTab,
  resetChat,
  chatFailure,
  clearChatFailure
} = useAIChat()
const { copy } = useClipboard()
const { dialogs } = useI18n()
const notifications = useNotificationMessages()
const editorStore = useEditorStore()

const chat = ref<Chat<UIMessage> | null>(null)
const isPreparingImages = ref(false)
const localActionPending = ref(false)
let attachmentOperationVersion = 0

void ensureChat(true)
  .then((c) => {
    if (c) chat.value = markRaw(c)
    return undefined
  })
  .catch((error: unknown) => {
    toast.error(
      notifications.value.chatInitializationFailed({
        error: error instanceof Error ? error.message : String(error)
      })
    )
  })
const messagesEnd = ref<HTMLDivElement>()
const debugCopied = refAutoReset(false, 1500)
const acpLogCopied = refAutoReset(false, 1500)

const messages = computed(() => chat.value?.messages ?? [])
const selectedPrototypeCandidates = computed(() => {
  void editorStore.state.sceneVersion
  return getSelectedDevicePrototypeFrameCandidates(editorStore)
})
const prototypeCandidates = computed(() => {
  return selectedPrototypeCandidates.value.length >= 2
    ? selectedPrototypeCandidates.value
    : getDevicePrototypeFrameCandidates(editorStore)
})
const canCreatePrototype = computed(
  () => prototypeCandidates.value.length >= 2 && prototypeCandidates.value.length <= 10
)
const failureMessage = computed(() => {
  switch (chatFailure.value?.reason) {
    case 'insufficient-credit':
      return dialogs.value.chatInsufficientCredit
    case 'output-limit':
      return dialogs.value.chatOutputLimit
    case 'request-failed':
      return dialogs.value.chatRequestFailed
    default:
      return null
  }
})
const status = computed(() =>
  localActionPending.value ? 'submitted' : (chat.value?.status ?? 'ready')
)
function isStreamingMessage(message: UIMessage, index: number): boolean {
  return (
    message.role === 'assistant' &&
    index === messages.value.length - 1 &&
    (status.value === 'submitted' || status.value === 'streaming')
  )
}
const isThinking = computed(() => {
  const s = status.value
  if (s !== 'submitted' && s !== 'streaming') return false
  if (messages.value.length === 0) return true
  const last = messages.value[messages.value.length - 1]
  if (last.role !== 'assistant') return true
  const parts = last.parts
  if (parts.length === 0) return true
  const lastPart = parts[parts.length - 1] as JSONObject
  if (lastPart.type === 'step-start') return true
  if ('toolCallId' in lastPart && lastPart.state === 'output-available') return true
  if ('toolCallId' in lastPart && lastPart.state === 'output-error') return true
  return s === 'submitted'
})

const showContinue = computed(() => {
  if (status.value !== 'ready') return false
  if (messages.value.length === 0) return false
  const last = messages.value[messages.value.length - 1]
  return last.role === 'assistant' && didHitStepLimit()
})

function scrollToBottom() {
  nextTick(() => {
    messagesEnd.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  })
}

watch(messages, scrollToBottom, { deep: true })
watch(
  () => chatFailure.value?.reason,
  (reason) => {
    if (!reason) return
    toast.error(failureMessage.value ?? dialogs.value.chatRequestFailed)
  }
)
watch(
  () => activeTab.value?.id,
  async () => {
    attachmentOperationVersion += 1
    isPreparingImages.value = false
    clearImageAttachmentPresentations()
    const nextChat = await ensureChat(true)
    chat.value = nextChat ? markRaw(nextChat) : null
  }
)

async function handleSubmit(text: string, images: ImageAttachmentDraft[] = []) {
  if (status.value === 'streaming' || status.value === 'submitted' || isPreparingImages.value) {
    for (const image of images) revokeImagePreviewURL(image.previewURL)
    if (images.length > 0) toast.error(dialogs.value.chatRequestFailed)
    return
  }

  if (!isConfigured.value) {
    for (const image of images) revokeImagePreviewURL(image.previewURL)
    toast.error('AI 服务尚未配置；设备烧录快捷操作仍可直接使用。')
    return
  }

  await handleConfiguredSubmit(text, images)
}

async function handleConfiguredSubmit(text: string, images: ImageAttachmentDraft[] = []) {
  const operationVersion = ++attachmentOperationVersion
  if (images.length > 0) isPreparingImages.value = true
  clearChatFailure()
  try {
    const currentChat = await ensureChat(true)
    if (currentChat) chat.value = markRaw(currentChat)
    if (!currentChat || operationVersion !== attachmentOperationVersion) {
      for (const image of images) revokeImagePreviewURL(image.previewURL)
      if (images.length > 0) toast.error(dialogs.value.chatRequestFailed)
      return
    }

    if (images.length === 0) {
      await currentChat.sendMessage({ text })
      return
    }

    const messageId = crypto.randomUUID()
    currentChat.messages = [
      ...currentChat.messages,
      { id: messageId, role: 'user', parts: [{ type: 'text', text }] }
    ]
    setImageAttachmentPresentations(
      messageId,
      images.map((image) => ({
        id: crypto.randomUUID(),
        messageId,
        name: image.file.name,
        mediaType: isImageAttachmentMediaType(image.file.type) ? image.file.type : 'image/png',
        originalWidth: 0,
        originalHeight: 0,
        previewWidth: 0,
        previewHeight: 0,
        previewURL: image.previewURL,
        displayText: text
      }))
    )

    const preparedImages = await Promise.all(
      images.map((image) => prepareImageAttachment(image.file))
    )
    const findings = await analyzeAttachedImages(getActiveEditorStore(), text, preparedImages)
    if (operationVersion !== attachmentOperationVersion || chat.value !== currentChat) return

    setImageAttachmentPresentations(
      messageId,
      preparedImages.map((prepared, index) => {
        const image = images[index]
        const previewURL = createImagePreviewURL(prepared.blob)
        return {
          id: crypto.randomUUID(),
          messageId,
          name: image?.file.name ?? `Image ${index + 1}`,
          mediaType: prepared.mediaType,
          originalWidth: prepared.originalWidth,
          originalHeight: prepared.originalHeight,
          previewWidth: prepared.width,
          previewHeight: prepared.height,
          previewURL,
          displayText: text
        }
      })
    )
    await currentChat.sendMessage({
      messageId,
      text: designMessageWithImageFindings(
        text,
        images.map((image) => image.file.name),
        findings
      )
    })
  } catch (e) {
    console.error('Chat error:', e)
    toast.error(dialogs.value.chatRequestFailed)
  } finally {
    if (operationVersion === attachmentOperationVersion) isPreparingImages.value = false
  }
}

async function handleFrameQuickAction(): Promise<void> {
  if (localActionPending.value) return
  localActionPending.value = true
  try {
    const localChat = await submitLocalDeviceAction('帮我烧录选中的画面')
    if (localChat) chat.value = markRaw(localChat)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  } finally {
    localActionPending.value = false
  }
}

async function handlePrototypeQuickAction(mode: 'manual' | 'slideshow'): Promise<void> {
  if (!canCreatePrototype.value || localActionPending.value) return
  const candidates = prototypeCandidates.value
  const text =
    mode === 'slideshow'
      ? `创建 ${candidates.length} 个画面的幻灯片，每 3 秒自动播放并烧录`
      : `创建 ${candidates.length} 个画面的手动浏览交互并烧录`
  localActionPending.value = true
  try {
    const localChat = await submitLocalDevicePrototypeAction(text, {
      intent: text,
      name:
        mode === 'slideshow'
          ? `自动播放 · ${candidates.length} 个画面`
          : `手动浏览 · ${candidates.length} 个画面`,
      mode,
      frameIds: candidates.map((candidate) => candidate.id),
      initialFrameId: candidates[0]?.id ?? '',
      transitions: [],
      manual:
        mode === 'manual'
          ? defaultManualSettingsForProfile(getActiveEmbeddedDisplayProfile().id)
          : undefined,
      slideshow: mode === 'slideshow' ? { intervalMs: 3000 } : undefined
    })
    if (localChat) chat.value = markRaw(localChat)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  } finally {
    localActionPending.value = false
  }
}

function handleStop() {
  chat.value?.stop()
}

async function handleCopyDebug() {
  await copyChatLog(messages.value, chatFailure.value)
  debugCopied.value = true
}

async function handleCopyACPLog() {
  const text = getACPDebugText()
  if (!text) return
  await copy(text)
  acpLogCopied.value = true
}

function handleClearChat() {
  attachmentOperationVersion += 1
  isPreparingImages.value = false
  clearChatFailure()
  clearImageAttachmentPresentations()
  chat.value = null
  void resetChat().catch((error: unknown) => {
    console.error('Chat reset error:', error)
  })
  clearToolLogEntries()
  clearACPDebugLog()
}
</script>

<template>
  <div data-test-id="chat-panel" class="flex min-w-0 flex-1 flex-col overflow-hidden select-text">
    <ScrollAreaRoot class="min-h-0 flex-1">
      <ScrollAreaViewport class="h-full px-3 py-3 [&>div]:h-full">
        <ProviderSetup v-if="!isConfigured && messages.length === 0" />
        <AppPlaceholder
          v-else-if="messages.length === 0"
          data-test-id="chat-empty-state"
          :label="dialogs.describeCreateOrChange"
          :ui="{ root: 'h-full' }"
        >
          <template #icon>
            <icon-lucide-message-circle class="size-5" />
          </template>
        </AppPlaceholder>

        <!-- Messages -->
        <div v-else data-test-id="chat-messages" class="flex flex-col gap-3">
          <ChatMessage
            v-for="(msg, index) in messages"
            :key="msg.id"
            :message="msg"
            :streaming="isStreamingMessage(msg, index)"
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
        :ui="{ base: 'flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-hover' }"
        @click="handleCopyDebug"
      >
        <icon-lucide-clipboard-copy v-if="!debugCopied" class="size-3" />
        <icon-lucide-check v-else class="size-3 text-green-400" />
        {{ debugCopied ? 'Copied' : 'Copy log' }}
      </AppTextButton>
      <AppTextButton
        v-if="IS_DEV && hasACPDebugEntries()"
        :ui="{ base: 'flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-hover' }"
        @click="handleCopyACPLog"
      >
        <icon-lucide-bug v-if="!acpLogCopied" class="size-3" />
        <icon-lucide-check v-else class="size-3 text-green-400" />
        {{ acpLogCopied ? 'Copied' : 'ACP log' }}
      </AppTextButton>
      <AppTextButton
        :ui="{ base: 'flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-hover' }"
        @click="handleClearChat"
      >
        <icon-lucide-trash-2 class="size-3" />
        Clear
      </AppTextButton>
    </div>

    <DeviceQuickActions
      :status="status"
      :selected-count="selectedPrototypeCandidates.length"
      :candidate-count="prototypeCandidates.length"
      :can-create-prototype="canCreatePrototype"
      @frame="handleFrameQuickAction"
      @prototype="handlePrototypeQuickAction"
      @open-interaction="activePropertiesTab = 'prototype'"
    />

    <ChatInput
      :status="status"
      :disabled="isPreparingImages"
      @submit="handleSubmit"
      @stop="handleStop"
      @error="toast.error"
    />

    <ACPPermissionDialog />
  </div>
</template>
