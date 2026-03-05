<script setup lang="ts" generic="T extends string | number">
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport
} from 'reka-ui'

defineProps<{
  options: { value: T; label: string }[]
  placeholder?: string
}>()

const modelValue = defineModel<T>({ required: true })
</script>

<template>
  <SelectRoot v-model="modelValue">
    <SelectTrigger
      data-test-id="app-select-trigger"
      class="flex min-w-0 flex-1 cursor-pointer items-center justify-between rounded border border-border bg-input px-1.5 py-1 text-xs text-surface outline-none hover:bg-hover"
    >
      <SelectValue :placeholder="placeholder" />
      <icon-lucide-chevron-down class="ml-1 size-3 shrink-0 text-muted" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="2"
        class="z-50 max-h-56 min-w-[var(--reka-select-trigger-width)] overflow-hidden rounded-md border border-border bg-panel shadow-lg"
      >
        <SelectViewport class="p-0.5">
          <SelectItem
            v-for="opt in options"
            :key="String(opt.value)"
            :value="opt.value"
            class="relative flex cursor-pointer items-center rounded py-1.5 pl-6 pr-2 text-xs text-surface outline-none data-[highlighted]:bg-hover"
          >
            <SelectItemIndicator class="absolute left-1.5 inline-flex items-center justify-center">
              <icon-lucide-check class="size-3 text-accent" />
            </SelectItemIndicator>
            <SelectItemText>{{ opt.label }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
