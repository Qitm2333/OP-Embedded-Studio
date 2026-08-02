<script setup lang="ts">
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectViewport
} from 'reka-ui'
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { useSelectUI } from '@/components/ui/select'
import { useEmbeddedDisplay } from '@/features/embedded-display'

const { disabled = false } = defineProps<{
  disabled?: boolean
}>()

const { dialogs } = useI18n()
const { profiles, selectedProfile, selectProfile } = useEmbeddedDisplay()

const selectedProfileId = computed({
  get: () => selectedProfile.value?.id ?? '',
  set: (id: string) => selectProfile(id)
})

const selectedDetails = computed(() => {
  const profile = selectedProfile.value
  if (!profile) return dialogs.value.targetScreen
  const size = `${profile.resolution.width} × ${profile.resolution.height}`
  return profile.visibleArea?.shape === 'round'
    ? `${profile.name} · ${size} · ${dialogs.value.roundScreen}`
    : `${profile.name} · ${size}`
})

const selectCls = useSelectUI({
  trigger:
    'flex size-7 shrink-0 items-center justify-center gap-0 overflow-hidden rounded border-none bg-transparent p-0 text-muted',
  content: 'max-h-64 min-w-64 overflow-y-auto',
  item: 'gap-2 rounded py-1.5 pr-7 pl-2 text-[11px]'
})
</script>

<template>
  <SelectRoot v-model="selectedProfileId" :disabled="disabled || profiles.length === 0">
    <SelectTrigger
      data-test-id="chat-screen-selector"
      :class="selectCls.trigger"
      :title="selectedDetails"
      :aria-label="`${dialogs.targetScreen}: ${selectedDetails}`"
    >
      <icon-lucide-monitor-smartphone class="size-3 shrink-0" />
      <span class="sr-only">{{ selectedDetails }}</span>
    </SelectTrigger>

    <SelectPortal>
      <SelectContent position="popper" side="top" :side-offset="4" :class="selectCls.content">
        <SelectViewport>
          <SelectItem
            v-for="profile in profiles"
            :key="profile.id"
            :value="profile.id"
            :class="selectCls.item"
          >
            <icon-lucide-circle
              v-if="profile.visibleArea?.shape === 'round'"
              class="size-3 shrink-0 text-muted"
            />
            <icon-lucide-square v-else class="size-3 shrink-0 text-muted" />
            <SelectItemText class="min-w-0 flex-1">
              <span class="block truncate text-surface">{{ profile.name }}</span>
              <span class="block text-[10px] text-muted">
                {{ profile.resolution.width }} × {{ profile.resolution.height }}
                <template v-if="profile.visibleArea?.shape === 'round'">
                  · {{ dialogs.roundScreen }}
                </template>
              </span>
            </SelectItemText>
            <SelectItemIndicator class="absolute right-2 inline-flex items-center">
              <icon-lucide-check class="size-3 text-accent" />
            </SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
