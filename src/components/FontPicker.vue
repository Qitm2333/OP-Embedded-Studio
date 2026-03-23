<script setup lang="ts">
import { nextTick, ref } from 'vue'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxVirtualizer,
  ComboboxViewport,
  type AcceptableValue
} from 'reka-ui'

import { useSelectUI } from '@/components/ui/select'
import { usePopoverUI } from '@/components/ui/popover'
import { listFamilies } from '@/engine/fonts'
import { useFontPicker } from '@open-pencil/vue'

const modelValue = defineModel<string>({ required: true })
const emit = defineEmits<{ select: [family: string] }>()

const cls = usePopoverUI({
  content: 'w-[var(--reka-combobox-trigger-width)] min-w-56 overflow-hidden p-0'
})
const inputRef = ref<HTMLInputElement | null>(null)
const selectCls = useSelectUI({
  trigger: 'w-full rounded px-2 py-1 text-xs',
  item: 'w-full gap-2 px-2 py-2 text-sm'
})

const { searchTerm, open, filtered, select } = useFontPicker({
  modelValue,
  listFamilies,
  onSelect: (family) => emit('select', family)
})
</script>

<template>
  <ComboboxRoot
    v-model:open="open"
    :model-value="modelValue"
    :ignore-filter="true"
    @update:model-value="
      (v: AcceptableValue) => {
        if (typeof v === 'string') select(v)
      }
    "
  >
    <ComboboxAnchor as-child>
      <button data-test-id="font-picker-trigger" :class="selectCls.trigger">
        <span class="truncate">{{ modelValue }}</span>
        <icon-lucide-chevron-down class="size-3 shrink-0 text-muted" />
      </button>
    </ComboboxAnchor>

    <ComboboxPortal>
      <ComboboxContent
        :side-offset="2"
        align="start"
        position="popper"
        :class="cls.content"
        @open-auto-focus.prevent
        @vue:mounted="nextTick(() => inputRef?.focus())"
      >
        <div class="flex items-center gap-1 border-b border-border px-2 py-1">
          <icon-lucide-search class="size-3 shrink-0 text-muted" />
          <ComboboxInput
            ref="inputRef"
            v-model="searchTerm"
            data-test-id="font-picker-search"
            class="min-w-0 flex-1 border-none bg-transparent text-xs text-surface outline-none placeholder:text-muted"
            placeholder="Search fonts…"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
          />
        </div>

        <ComboboxViewport class="max-h-72 overflow-y-auto">
          <ComboboxVirtualizer
            v-slot="{ option }"
            :options="filtered"
            :text-content="(family: string) => family"
            :estimate-size="36"
          >
            <ComboboxItem
              :value="option"
              data-test-id="font-picker-item"
              :class="selectCls.item"
              :style="{ fontFamily: `'${option}', sans-serif` }"
            >
              <ComboboxItemIndicator>
                <icon-lucide-check class="size-3 shrink-0 text-accent" />
              </ComboboxItemIndicator>
              <span v-if="option !== modelValue" class="size-3 shrink-0" />
              <span class="truncate">{{ option }}</span>
            </ComboboxItem>
          </ComboboxVirtualizer>

          <div
            v-if="filtered.length === 0 && searchTerm"
            class="px-2 py-3 text-center text-xs text-muted"
          >
            No fonts found
          </div>
          <div
            v-else-if="filtered.length === 0"
            class="flex h-full items-center justify-center px-3 py-3 text-center text-xs text-muted"
          >
            <div>
              <p>No local fonts available.</p>
              <p class="mt-1">Use the desktop app or Chrome/Edge to access system fonts.</p>
            </div>
          </div>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
