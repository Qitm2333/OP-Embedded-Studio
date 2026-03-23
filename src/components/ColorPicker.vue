<script setup lang="ts">
import { computed } from 'vue'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'
import { colorToCSS } from '@open-pencil/core'

import HsvColorArea from './HsvColorArea.vue'
import { usePopoverUI } from './ui/popover'

import type { Color } from '@open-pencil/core'

const { color } = defineProps<{ color: Color }>()
const emit = defineEmits<{ update: [color: Color] }>()
const cls = usePopoverUI({ content: 'w-56 p-2' })

const swatchBg = computed(() => colorToCSS(color))
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <button
        data-test-id="color-picker-swatch"
        class="size-5 shrink-0 cursor-pointer rounded border border-border p-0"
        :style="{ background: swatchBg }"
      />
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        data-test-id="color-picker-popover"
        :class="cls.content"
        :side-offset="4"
        side="left"
      >
        <HsvColorArea :color="color" @update="emit('update', $event)" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
