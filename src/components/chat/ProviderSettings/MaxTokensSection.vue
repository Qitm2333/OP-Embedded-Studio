<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

import { useInputUI } from '@/components/ui/input'
import { useProviderSettingsContext } from '@/components/chat/ProviderSettings/context'

const ctx = useProviderSettingsContext()
const { dialogs } = useI18n()
</script>

<template>
  <div v-if="!ctx.isACP" class="flex flex-col gap-1">
    <label class="text-[10px] text-muted">{{ dialogs.maxOutputTokens }}</label>
    <input
      v-model.number="ctx.maxOutputTokens"
      type="number"
      data-test-id="provider-settings-max-tokens"
      :min="1024"
      :max="128000"
      :step="1024"
      :class="useInputUI({ size: 'sm' }).base"
    />
  </div>
</template>
