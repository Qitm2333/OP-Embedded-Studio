<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { useAIChat } from '@/app/ai/chat/use'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'

const { disabled = false } = defineProps<{ disabled?: boolean }>()
const { dialogs } = useI18n()
const { chatMode } = useAIChat()

const options = computed(() => [
  { value: 'design', label: dialogs.value.designMode, disabled },
  { value: 'device', label: dialogs.value.deviceMode, disabled }
])
</script>

<template>
  <SegmentedControl
    v-model="chatMode"
    data-test-id="chat-mode-selector"
    :options="options"
    :label="dialogs.chatMode"
    :ui="{
      root: 'h-7 w-[6.5rem] shrink-0 border-none bg-transparent p-0',
      item: 'h-6 px-1 text-[10px]'
    }"
  >
    <template #option="{ option }">
      <icon-lucide-pen-tool v-if="option.value === 'design'" class="size-3 shrink-0" />
      <icon-lucide-usb v-else class="size-3 shrink-0" />
      <span class="truncate">{{ option.label }}</span>
    </template>
  </SegmentedControl>
</template>
