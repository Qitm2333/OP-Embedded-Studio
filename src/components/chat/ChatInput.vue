<script setup lang="ts">
import { useFileDialog } from '@vueuse/core'
import { TooltipProvider } from 'reka-ui'
import { computed, nextTick, ref, watch } from 'vue'

import type { FileUIPart } from 'ai'
import { ACP_AGENTS } from '@open-pencil/core/constants'
import { useI18n } from '@open-pencil/vue'

import {
  CHAT_IMAGE_ACCEPT,
  CHAT_IMAGE_MAX_COUNT,
  prepareChatImage
} from '@/app/ai/chat/attachments'
import { modelSupportsImageInput } from '@/app/ai/chat/model'
import type { AIChatMode } from '@/app/ai/chat/storage'
import { useAIChat } from '@/app/ai/chat/use'
import { toast } from '@/app/shell/ui'
import ProviderModelSelect from '@/components/chat/ProviderModelSelect.vue'
import ProviderSettings from '@/components/chat/ProviderSettings/ProviderSettings.vue'
import ChatScreenSelect from '@/components/chat/ChatScreenSelect.vue'
import ChatModeSelect from '@/components/chat/ChatModeSelect.vue'
import Tip from '@/components/ui/Tip.vue'
import { useButtonUI } from '@/components/ui/button'

const { providerID, providerDef, modelID, customModelID, chatMode } = useAIChat()
const { dialogs } = useI18n()

const { status } = defineProps<{
  status: 'ready' | 'submitted' | 'streaming' | 'error'
}>()

const emit = defineEmits<{
  submit: [text: string, files: FileUIPart[]]
  stop: []
}>()

const input = ref('')
const textarea = ref<HTMLTextAreaElement>()
const attachments = ref<FileUIPart[]>([])
const isPreparing = ref(false)
const isDragging = ref(false)
const drafts: Record<AIChatMode, { input: string; attachments: FileUIPart[] }> = {
  design: { input: '', attachments: [] },
  device: { input: '', attachments: [] }
}

const {
  open: openFiles,
  reset: resetFiles,
  onChange
} = useFileDialog({
  accept: CHAT_IMAGE_ACCEPT,
  multiple: true,
  reset: true
})

const isStreaming = computed(() => status === 'streaming' || status === 'submitted')
const supportsImages = computed(() =>
  chatMode.value === 'design'
    ? modelSupportsImageInput({
        providerID: providerID.value,
        modelID: modelID.value,
        customModelID: customModelID.value
      })
    : false
)
const inputPlaceholder = computed(() =>
  chatMode.value === 'device' ? dialogs.value.describeDeviceAction : dialogs.value.describeChange
)
const attachmentLabel = computed(() => {
  if (chatMode.value === 'device') return dialogs.value.deviceModeNoReferenceImage
  return supportsImages.value
    ? dialogs.value.attachReferenceImage
    : dialogs.value.selectedModelNoImageSupport
})
const canSubmit = computed(
  () =>
    !isStreaming.value &&
    !isPreparing.value &&
    (!!input.value.trim() || attachments.value.length > 0)
)
const isACPProvider = computed(() => providerID.value.startsWith('acp:'))
const acpAgentName = computed(() => {
  const agentId = providerID.value.replace('acp:', '')
  return ACP_AGENTS.find((a) => a.id === agentId)?.name ?? agentId
})
const isCustomProvider = computed(
  () => providerID.value === 'openai-compatible' || providerID.value === 'anthropic-compatible'
)
const customModelName = computed(() => customModelID.value.trim())
const usesCustomModel = computed(
  () => !!providerDef.value.supportsCustomModel && !!customModelName.value
)
const selectedModelName = computed(() => {
  if (usesCustomModel.value) return customModelName.value
  if (isCustomProvider.value) return 'No model'
  return providerDef.value.models.find((model) => model.id === modelID.value)?.name ?? modelID.value
})

function resizeTextarea() {
  nextTick(() => {
    if (!textarea.value) return
    textarea.value.style.height = 'auto'
    textarea.value.style.height = `${Math.min(textarea.value.scrollHeight, 144)}px`
  })
}

watch(chatMode, (nextMode, previousMode) => {
  drafts[previousMode] = {
    input: input.value,
    attachments: previousMode === 'design' ? [...attachments.value] : []
  }
  input.value = drafts[nextMode].input
  attachments.value = nextMode === 'design' ? [...drafts.design.attachments] : []
  isDragging.value = false
  resizeTextarea()
})

async function addFiles(files: File[]) {
  if (!supportsImages.value) {
    toast.error(attachmentLabel.value)
    return
  }
  const remaining = CHAT_IMAGE_MAX_COUNT - attachments.value.length
  if (remaining <= 0) {
    toast.error(dialogs.value.referenceImageLimit)
    return
  }
  if (files.length > remaining) toast.error(dialogs.value.referenceImageLimit)

  isPreparing.value = true
  try {
    for (const file of files.slice(0, remaining)) {
      try {
        attachments.value.push(await prepareChatImage(file))
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error))
      }
    }
  } finally {
    isPreparing.value = false
    resetFiles()
  }
}

onChange((files) => {
  if (files) void addFiles(Array.from(files))
})

function handlePaste(event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
    file.type.startsWith('image/')
  )
  if (files.length === 0) return
  event.preventDefault()
  void addFiles(files)
}

function handleDrop(event: DragEvent) {
  isDragging.value = false
  const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
    file.type.startsWith('image/')
  )
  if (files.length > 0) void addFiles(files)
}

function removeAttachment(index: number) {
  attachments.value.splice(index, 1)
}

function handleSubmit() {
  if (!canSubmit.value) return
  emit('submit', input.value.trim(), [...attachments.value])
  input.value = ''
  attachments.value = []
  resizeTextarea()
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  handleSubmit()
}
</script>

<template>
  <TooltipProvider>
    <div class="shrink-0 border-t border-border p-3">
      <form
        class="overflow-hidden rounded-lg border bg-input transition-colors"
        :class="
          isDragging
            ? 'border-accent ring-1 ring-accent'
            : 'border-border focus-within:border-muted'
        "
        @submit.prevent="handleSubmit"
        @dragenter.prevent="isDragging = true"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop"
      >
        <div v-if="attachments.length" class="flex gap-2 overflow-x-auto px-2.5 pt-2.5">
          <div
            v-for="(attachment, index) in attachments"
            :key="`${attachment.filename}-${index}`"
            data-test-id="chat-attachment-preview"
            class="group relative size-14 shrink-0 overflow-hidden rounded-md border border-border bg-canvas"
          >
            <img :src="attachment.url" :alt="attachment.filename" class="size-full object-cover" />
            <Tip :label="dialogs.removeReferenceImage">
              <button
                type="button"
                class="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                :aria-label="dialogs.removeReferenceImage"
                @click="removeAttachment(index)"
              >
                <icon-lucide-x class="size-3" />
              </button>
            </Tip>
          </div>
        </div>

        <textarea
          ref="textarea"
          v-model="input"
          data-test-id="chat-input"
          :placeholder="inputPlaceholder"
          :disabled="chatMode === 'device' && isStreaming"
          rows="1"
          class="block max-h-36 min-h-12 w-full resize-none bg-transparent px-3 py-3 text-sm leading-5 text-surface outline-none placeholder:text-muted disabled:opacity-50"
          @input="resizeTextarea"
          @keydown="handleKeydown"
          @paste.stop="handlePaste"
          @copy.stop
          @cut.stop
        />

        <div class="flex h-9 min-w-0 items-center gap-1 border-t border-border/70 px-1.5">
          <Tip :label="attachmentLabel">
            <button
              type="button"
              data-test-id="chat-attach-button"
              class="flex size-7 shrink-0 items-center justify-center rounded text-muted transition-colors hover:bg-hover hover:text-surface disabled:opacity-40"
              :aria-label="dialogs.attachReferenceImage"
              :disabled="isStreaming || isPreparing || !supportsImages"
              @click="openFiles()"
            >
              <icon-lucide-paperclip class="size-4" />
            </button>
          </Tip>

          <ChatModeSelect :disabled="isStreaming || isPreparing" />
          <ChatScreenSelect :disabled="isStreaming" />

          <template v-if="isACPProvider">
            <div class="flex min-w-0 flex-1 items-center gap-1 px-1 text-[11px] text-muted">
              <icon-lucide-bot class="size-3 shrink-0" />
              <span class="truncate">{{ acpAgentName }}</span>
            </div>
          </template>
          <template v-else-if="isCustomProvider || usesCustomModel">
            <div
              data-test-id="chat-custom-model-label"
              class="flex min-w-0 flex-1 items-center gap-1 px-1 text-[11px] text-muted"
            >
              <icon-lucide-bot class="size-3 shrink-0" />
              <span class="truncate">{{ selectedModelName }}</span>
            </div>
          </template>
          <ProviderModelSelect v-else>
            <template #value>{{ selectedModelName }}</template>
          </ProviderModelSelect>

          <div class="ml-auto flex items-center gap-1">
            <ProviderSettings />
            <Tip v-if="isStreaming" :label="dialogs.stopGenerating">
              <button
                type="button"
                data-test-id="chat-stop-button"
                :class="
                  useButtonUI({
                    tone: 'ghost',
                    shape: 'square',
                    size: 'sm',
                    ui: { base: 'size-7 border border-border p-0' }
                  }).base
                "
                @click="emit('stop')"
              >
                <icon-lucide-square class="size-3" />
              </button>
            </Tip>
            <Tip v-else :label="dialogs.sendMessage">
              <button
                type="submit"
                data-test-id="chat-send-button"
                :class="
                  useButtonUI({
                    tone: 'accent',
                    shape: 'square',
                    size: 'sm',
                    ui: { base: 'size-7 p-0' }
                  }).base
                "
                :disabled="!canSubmit"
              >
                <icon-lucide-arrow-up class="size-4" />
              </button>
            </Tip>
          </div>
        </div>
      </form>
    </div>
  </TooltipProvider>
</template>
