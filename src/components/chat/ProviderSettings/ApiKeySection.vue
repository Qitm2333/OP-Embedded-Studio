<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

import { openExternalLink } from '@/app/shell/ui'
import { useInputUI } from '@/components/ui/input'
import { useProviderSettingsContext } from '@/components/chat/ProviderSettings/context'

const ctx = useProviderSettingsContext()
const { dialogs } = useI18n()
</script>

<template>
  <div v-if="!ctx.isACP" class="flex flex-col gap-1">
    <div class="flex items-center justify-between">
      <label class="text-[10px] text-muted">{{ dialogs.apiKey }}</label>
      <button
        v-if="ctx.apiKey"
        class="cursor-pointer text-[10px] text-muted hover:text-surface"
        data-test-id="provider-settings-clear-key"
        @click="ctx.clearKey"
      >
        {{ dialogs.clear }}
      </button>
    </div>
    <input
      v-model="ctx.keyInput"
      type="password"
      data-test-id="provider-settings-api-key"
      :placeholder="
        ctx.hasExistingKey ? dialogs.keySavedReplace : ctx.providerDef.keyPlaceholder
      "
      :class="useInputUI({ size: 'sm' }).base"
      @change="ctx.save"
    />
    <button
      v-if="ctx.providerDef.keyURL"
      type="button"
      class="cursor-pointer text-[9px] text-muted underline hover:text-surface"
      @click="openExternalLink(ctx.providerDef.keyURL as string)"
    >
      {{ dialogs.getAPIKeyGeneric }}
    </button>
  </div>
</template>
