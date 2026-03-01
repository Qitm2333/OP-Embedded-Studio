<script setup lang="ts">
import {
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectViewport,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger
} from 'reka-ui'
import { computed, ref } from 'vue'

import { MODELS, useAIChat } from '@/composables/use-chat'

const { modelId } = useAIChat()

const props = defineProps<{
  status: 'ready' | 'submitted' | 'streaming' | 'error'
}>()

const emit = defineEmits<{
  submit: [text: string]
  stop: []
}>()

const input = ref('')

const isStreaming = computed(() => props.status === 'streaming' || props.status === 'submitted')
const selectedModelName = computed(
  () => MODELS.find((m) => m.id === modelId.value)?.name ?? modelId.value
)

function handleSubmit(e: Event) {
  e.preventDefault()
  const text = input.value.trim()
  if (!text) return
  emit('submit', text)
  input.value = ''
}
</script>

<template>
  <TooltipProvider>
    <div class="shrink-0 border-t border-border px-3 py-2">
      <!-- Model selector -->
      <div class="mb-1.5 flex items-center">
        <SelectRoot v-model="modelId">
          <SelectTrigger
            class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted hover:bg-hover hover:text-surface"
          >
            <icon-lucide-bot class="size-3" />
            {{ selectedModelName }}
            <icon-lucide-chevron-down class="size-2.5" />
          </SelectTrigger>
          <SelectPortal>
            <SelectContent
              position="popper"
              side="top"
              :side-offset="4"
              class="z-50 max-h-60 overflow-y-auto rounded-lg border border-border bg-panel p-1 shadow-lg"
            >
              <SelectViewport>
                <SelectItem
                  v-for="model in MODELS"
                  :key="model.id"
                  :value="model.id"
                  class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[11px] text-surface outline-none data-[highlighted]:bg-hover"
                >
                  <SelectItemText class="flex-1">{{ model.name }}</SelectItemText>
                  <span
                    v-if="model.tag"
                    class="rounded bg-accent/10 px-1 py-px text-[9px] text-accent"
                  >
                    {{ model.tag }}
                  </span>
                </SelectItem>
              </SelectViewport>
            </SelectContent>
          </SelectPortal>
        </SelectRoot>
      </div>

      <!-- Input form -->
      <form class="flex gap-1.5" @submit="handleSubmit">
        <input
          v-model="input"
          type="text"
          placeholder="Describe a change…"
          class="min-w-0 flex-1 rounded border border-border bg-input px-2.5 py-1.5 text-xs text-surface outline-none placeholder:text-muted focus:border-accent"
          :disabled="status === 'submitted'"
        />
        <TooltipRoot v-if="isStreaming">
          <TooltipTrigger as-child>
            <button
              type="button"
              class="shrink-0 rounded border border-border px-2 py-1.5 text-xs text-muted hover:bg-hover"
              @click="emit('stop')"
            >
              <icon-lucide-square class="size-3" />
            </button>
          </TooltipTrigger>
          <TooltipPortal>
            <TooltipContent
              side="top"
              :side-offset="4"
              class="rounded bg-surface px-2 py-1 text-[10px] text-canvas"
            >
              Stop generating
            </TooltipContent>
          </TooltipPortal>
        </TooltipRoot>
        <TooltipRoot v-else>
          <TooltipTrigger as-child>
            <button
              type="submit"
              class="shrink-0 rounded bg-accent px-2.5 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
              :disabled="!input.trim()"
            >
              <icon-lucide-send class="size-3" />
            </button>
          </TooltipTrigger>
          <TooltipPortal>
            <TooltipContent
              side="top"
              :side-offset="4"
              class="rounded bg-surface px-2 py-1 text-[10px] text-canvas"
            >
              Send message
            </TooltipContent>
          </TooltipPortal>
        </TooltipRoot>
      </form>
    </div>
  </TooltipProvider>
</template>
