<script setup lang="ts">
import { usePropertyList } from './context'

const { index } = defineProps<{
  index: number
}>()

const { update, remove, toggleVisibility } = usePropertyList()
</script>

<template>
  <slot
    :index="index"
    :update="(patch: Record<string, unknown>) => update(index, patch)"
    :remove="() => remove(index)"
    :toggle-visibility="() => toggleVisibility(index)"
  />
</template>
