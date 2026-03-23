<script setup lang="ts">
import { computed } from 'vue'
import { colorToHexRaw, parseColor } from '@open-pencil/core'

import type { Color } from '@open-pencil/core'

const props = defineProps<{
  color: Color
  editable?: boolean
}>()

const emit = defineEmits<{ update: [color: Color] }>()

const hex = computed(() => colorToHexRaw(props.color))

function updateFromHex(value: string) {
  const parsed = parseColor(value.startsWith('#') ? value : `#${value}`)
  emit('update', { ...parsed, a: props.color.a })
}
</script>

<template>
  <slot
    :color="color"
    :editable="editable ?? false"
    :hex="hex"
    :update-from-hex="updateFromHex"
    :update-color="(nextColor: Color) => emit('update', nextColor)"
  />
</template>
