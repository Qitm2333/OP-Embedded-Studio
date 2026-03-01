<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { useAIChat } from '@/composables/use-chat'

import type { DesignMessage } from '@/composables/use-chat'
import type { Chat } from '@ai-sdk/vue'

const { apiKey, isConfigured, createChat } = useAIChat()

const chat = ref<Chat<DesignMessage> | null>(null)
const input = ref('')
const messagesEnd = ref<HTMLDivElement>()
const apiKeyInput = ref('')

const messages = computed(() => chat.value?.messages ?? [])
const status = computed(() => chat.value?.status ?? 'ready')
const isStreaming = computed(() => status.value === 'streaming' || status.value === 'submitted')

function ensureChat() {
  if (!chat.value && isConfigured.value) {
    chat.value = createChat()
  }
  return chat.value
}

function scrollToBottom() {
  nextTick(() => {
    messagesEnd.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  })
}

watch(messages, scrollToBottom, { deep: true })

function handleSubmit(e: Event) {
  e.preventDefault()
  const text = input.value.trim()
  if (!text) return

  const c = ensureChat()
  if (!c) return

  c.sendMessage({ text })
  input.value = ''
}

function handleStop() {
  chat.value?.stop()
}

function saveApiKey() {
  apiKey.value = apiKeyInput.value.trim()
  apiKeyInput.value = ''
}

function getTextContent(msg: DesignMessage): string {
  return msg.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

interface ToolPart {
  type: string
  toolCallId: string
  toolName: string
  state: string
  input?: unknown
  output?: unknown
  errorText?: string
}

function isToolPart(part: unknown): part is ToolPart {
  return (
    typeof part === 'object' &&
    part !== null &&
    'type' in part &&
    typeof (part as ToolPart).type === 'string' &&
    (part as ToolPart).type.startsWith('tool-')
  )
}

function getToolParts(msg: DesignMessage): ToolPart[] {
  return msg.parts.filter(isToolPart)
}

function toolDisplayName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function toolState(part: ToolPart): 'pending' | 'done' | 'error' {
  if (part.state === 'error') return 'error'
  if (part.state === 'output-available') return 'done'
  return 'pending'
}
</script>

<template>
  <aside
    class="flex min-w-0 flex-1 flex-col overflow-hidden border-l border-border bg-panel"
    style="contain: paint layout style"
  >
    <!-- Header -->
    <div class="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
      <icon-lucide-sparkles class="size-4 text-accent" />
      <span class="text-xs font-semibold">AI Chat</span>
      <span v-if="isStreaming" class="ml-auto text-[10px] text-muted"> streaming… </span>
    </div>

    <!-- API key setup -->
    <div v-if="!isConfigured" class="flex flex-1 flex-col items-center justify-center gap-4 px-4">
      <icon-lucide-key-round class="size-8 text-muted" />
      <p class="text-center text-xs text-muted">Enter your OpenRouter API key to start chatting.</p>
      <form class="flex w-full gap-1.5" @submit.prevent="saveApiKey">
        <input
          v-model="apiKeyInput"
          type="password"
          placeholder="sk-or-…"
          class="min-w-0 flex-1 rounded border border-border bg-input px-2 py-1 text-xs text-surface outline-none focus:border-accent"
        />
        <button
          type="submit"
          class="shrink-0 rounded bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent/90"
          :disabled="!apiKeyInput.trim()"
        >
          Save
        </button>
      </form>
      <a
        href="https://openrouter.ai/keys"
        target="_blank"
        class="text-[10px] text-muted underline hover:text-surface"
      >
        Get an API key →
      </a>
    </div>

    <!-- Chat messages -->
    <template v-else>
      <div class="flex-1 overflow-y-auto px-3 py-3">
        <!-- Empty state -->
        <div
          v-if="messages.length === 0"
          class="flex h-full flex-col items-center justify-center gap-3 text-muted"
        >
          <icon-lucide-message-circle class="size-8 opacity-50" />
          <p class="text-xs">Describe what you want to create or change.</p>
        </div>

        <!-- Messages -->
        <div v-else class="flex flex-col gap-3">
          <div
            v-for="msg in messages"
            :key="msg.id"
            class="flex gap-2"
            :class="msg.role === 'user' ? 'flex-row-reverse' : ''"
          >
            <!-- Avatar -->
            <div
              class="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
              :class="msg.role === 'user' ? 'bg-accent/20 text-accent' : 'bg-muted/20 text-muted'"
            >
              {{ msg.role === 'user' ? 'U' : 'AI' }}
            </div>

            <!-- Content -->
            <div class="min-w-0 max-w-[85%] space-y-1.5">
              <!-- Tool timeline -->
              <div
                v-if="msg.role === 'assistant' && getToolParts(msg).length > 0"
                class="rounded-lg border border-border bg-canvas p-2"
              >
                <div
                  v-for="tool in getToolParts(msg)"
                  :key="tool.toolCallId"
                  class="flex items-center gap-2 py-0.5"
                >
                  <div
                    class="flex size-4 items-center justify-center rounded-full"
                    :class="{
                      'bg-accent/20 text-accent': toolState(tool) === 'pending',
                      'bg-green-500/20 text-green-400': toolState(tool) === 'done',
                      'bg-red-500/20 text-red-400': toolState(tool) === 'error'
                    }"
                  >
                    <icon-lucide-loader-circle
                      v-if="toolState(tool) === 'pending'"
                      class="size-3 animate-spin"
                    />
                    <icon-lucide-check v-else-if="toolState(tool) === 'done'" class="size-3" />
                    <icon-lucide-triangle-alert v-else class="size-3" />
                  </div>
                  <span class="text-[11px] text-surface">
                    {{ toolDisplayName(tool.toolName) }}
                  </span>
                  <span class="text-[10px] text-muted">
                    {{
                      toolState(tool) === 'pending'
                        ? 'Running…'
                        : toolState(tool) === 'done'
                          ? 'Done'
                          : 'Error'
                    }}
                  </span>
                </div>
              </div>

              <!-- Text bubble -->
              <div
                v-if="getTextContent(msg)"
                class="whitespace-pre-wrap rounded-xl px-3 py-2 text-xs leading-relaxed"
                :class="
                  msg.role === 'user'
                    ? 'rounded-br-md bg-accent text-white'
                    : 'rounded-tl-md bg-hover text-surface'
                "
              >
                {{ getTextContent(msg) }}
              </div>
            </div>
          </div>

          <!-- Typing indicator -->
          <div v-if="status === 'submitted'" class="flex gap-2">
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

          <div ref="messagesEnd" />
        </div>
      </div>

      <!-- Input -->
      <div class="shrink-0 border-t border-border px-3 py-2">
        <form class="flex gap-1.5" @submit="handleSubmit">
          <input
            v-model="input"
            type="text"
            placeholder="Describe a change…"
            class="min-w-0 flex-1 rounded border border-border bg-input px-2.5 py-1.5 text-xs text-surface outline-none placeholder:text-muted focus:border-accent"
            :disabled="status === 'submitted'"
          />
          <button
            v-if="isStreaming"
            type="button"
            class="shrink-0 rounded border border-border px-2 py-1.5 text-xs text-muted hover:bg-hover"
            @click="handleStop"
          >
            <icon-lucide-square class="size-3" />
          </button>
          <button
            v-else
            type="submit"
            class="shrink-0 rounded bg-accent px-2.5 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
            :disabled="!input.trim()"
          >
            <icon-lucide-send class="size-3" />
          </button>
        </form>
      </div>
    </template>
  </aside>
</template>
