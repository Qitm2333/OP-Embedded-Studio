<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

import { openExternalLink } from '@/app/shell/ui'
import { useInputUI } from '@/components/ui/input'
import { useProviderSettingsContext } from '@/components/chat/ProviderSettings/context'

const ctx = useProviderSettingsContext()
const { dialogs } = useI18n()
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-center justify-between">
      <label class="text-[10px] text-muted">{{ dialogs.pexelsAPIKey }}</label>
      <button
        v-if="ctx.pexelsApiKey"
        class="cursor-pointer text-[10px] text-muted hover:text-surface"
        data-test-id="provider-settings-clear-pexels-key"
        @click="ctx.clearPexelsKey"
      >
        {{ dialogs.clear }}
      </button>
    </div>
    <input
      v-model="ctx.pexelsKeyInput"
      type="password"
      data-test-id="provider-settings-pexels-key"
      :placeholder="
        ctx.hasExistingPexelsKey ? dialogs.keySavedReplace : dialogs.stockPhotoToolOptional
      "
      :class="useInputUI({ size: 'sm' }).base"
      @change="ctx.save"
    />
    <button
      type="button"
      class="cursor-pointer text-[9px] text-muted underline hover:text-surface"
      @click="openExternalLink('https://www.pexels.com/api/')"
    >
      {{ dialogs.getPexelsAPIKey }}
    </button>
  </div>

  <div class="flex flex-col gap-1">
    <div class="flex items-center justify-between">
      <label class="text-[10px] text-muted">{{ dialogs.unsplashAccessKey }}</label>
      <button
        v-if="ctx.unsplashAccessKey"
        class="cursor-pointer text-[10px] text-muted hover:text-surface"
        data-test-id="provider-settings-clear-unsplash-key"
        @click="ctx.clearUnsplashKey"
      >
        {{ dialogs.clear }}
      </button>
    </div>
    <input
      v-model="ctx.unsplashKeyInput"
      type="password"
      data-test-id="provider-settings-unsplash-key"
      :placeholder="
        ctx.hasExistingUnsplashKey ? dialogs.keySavedReplace : dialogs.pexelsAlternativeOptional
      "
      :class="useInputUI({ size: 'sm' }).base"
      @change="ctx.save"
    />
    <button
      type="button"
      class="cursor-pointer text-[9px] text-muted underline hover:text-surface"
      @click="openExternalLink('https://unsplash.com/oauth/applications')"
    >
      {{ dialogs.getUnsplashAccessKey }}
    </button>
  </div>
</template>
