<script setup lang="ts">
import { computed } from 'vue'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'

import HsvColorArea from './HsvColorArea.vue'

import type { Color } from '@/types'

const props = defineProps<{
  color: Color
}>()

const emit = defineEmits<{
  update: [color: Color]
}>()

const swatchColor = computed(() => {
  const c = props.color
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a})`
})
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <button
        class="size-5 shrink-0 cursor-pointer rounded border border-border p-0"
        :style="{ background: swatchColor }"
      />
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        class="z-[100] w-56 rounded-lg border border-border bg-panel p-2 shadow-xl"
        :side-offset="4"
        side="left"
      >
        <HsvColorArea :color="color" @update="emit('update', $event)" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
